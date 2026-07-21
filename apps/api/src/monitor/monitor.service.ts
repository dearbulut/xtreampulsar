import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const execAsync = promisify(exec);

interface CpuSample {
  idle: number;
  total: number;
}

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);
  // Uyarı tekrarını önle: metrik başına son uyarı zamanı (30 dk soğuma).
  private readonly lastAlert = new Map<string, number>();
  private lastNet: { rx: number; tx: number; at: number } | null = null;
  private static readonly COOLDOWN_MS = 30 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private cpuSnapshot(): CpuSample {
    let idle = 0;
    let total = 0;
    for (const c of os.cpus()) {
      for (const t of Object.values(c.times)) total += t;
      idle += c.times.idle;
    }
    return { idle, total };
  }

  private async cpuPercent(): Promise<number> {
    const a = this.cpuSnapshot();
    await new Promise((r) => setTimeout(r, 200));
    const b = this.cpuSnapshot();
    const idle = b.idle - a.idle;
    const total = b.total - a.total;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100)));
  }

  private memPercent(): number {
    const total = os.totalmem();
    if (total <= 0) return 0;
    return Math.round((1 - os.freemem() / total) * 100);
  }

  private async diskPercent(): Promise<number> {
    try {
      const { stdout } = await execAsync('df -P / | tail -1');
      const pct = parseInt(stdout.trim().split(/\s+/)[4], 10);
      return isNaN(pct) ? 0 : pct;
    } catch {
      return 0;
    }
  }

  private readNetTotals(): { rx: number; tx: number } {
    try {
      const data = fs.readFileSync('/proc/net/dev', 'utf8');
      let rx = 0;
      let tx = 0;
      for (const line of data.split('\n')) {
        const m = line.match(/^\s*([^:]+):\s*(.+)$/);
        if (!m) continue;
        if (m[1].trim() === 'lo') continue;
        const cols = m[2].trim().split(/\s+/).map(Number);
        rx += cols[0] || 0;
        tx += cols[8] || 0;
      }
      return { rx, tx };
    } catch {
      return { rx: 0, tx: 0 };
    }
  }

  /** Son çağrıya göre ağ throughput'u (Mbps). İlk çağrı 0 döner. */
  private netThroughput(): { rxMbps: number; txMbps: number } {
    const now = this.readNetTotals();
    const at = Date.now();
    const prev = this.lastNet;
    this.lastNet = { rx: now.rx, tx: now.tx, at };
    if (!prev || at <= prev.at) return { rxMbps: 0, txMbps: 0 };
    const secs = (at - prev.at) / 1000;
    const rxMbps = Math.max(0, ((now.rx - prev.rx) * 8) / secs / 1e6);
    const txMbps = Math.max(0, ((now.tx - prev.tx) * 8) / secs / 1e6);
    return { rxMbps: Math.round(rxMbps * 10) / 10, txMbps: Math.round(txMbps * 10) / 10 };
  }

  /** Anlık kaynak durumu. */
  async getStatus() {
    const [cpu, disk] = await Promise.all([this.cpuPercent(), this.diskPercent()]);
    const net = this.netThroughput();
    return {
      cpu,
      mem: this.memPercent(),
      disk,
      rxMbps: net.rxMbps,
      txMbps: net.txMbps,
      memTotalMb: Math.round(os.totalmem() / 1_048_576),
      memUsedMb: Math.round((os.totalmem() - os.freemem()) / 1_048_576),
      loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
      cores: os.cpus().length,
      uptimeSecs: Math.round(os.uptime()),
    };
  }

  async getConfig() {
    const s = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
      select: { sysMonitorEnabled: true, cpuAlertPct: true, memAlertPct: true, diskAlertPct: true, netAlertMbps: true },
    });
    return { enabled: s.sysMonitorEnabled, cpuAlertPct: s.cpuAlertPct, memAlertPct: s.memAlertPct, diskAlertPct: s.diskAlertPct, netAlertMbps: s.netAlertMbps };
  }

  async updateConfig(dto: { enabled?: boolean; cpuAlertPct?: number; memAlertPct?: number; diskAlertPct?: number; netAlertMbps?: number }) {
    const clamp = (n: number) => Math.max(1, Math.min(100, Math.floor(Number(n))));
    const data: { sysMonitorEnabled?: boolean; cpuAlertPct?: number; memAlertPct?: number; diskAlertPct?: number; netAlertMbps?: number } = {};
    if (dto.enabled !== undefined) data.sysMonitorEnabled = Boolean(dto.enabled);
    if (dto.cpuAlertPct !== undefined) data.cpuAlertPct = clamp(dto.cpuAlertPct);
    if (dto.memAlertPct !== undefined) data.memAlertPct = clamp(dto.memAlertPct);
    if (dto.diskAlertPct !== undefined) data.diskAlertPct = clamp(dto.diskAlertPct);
    if (dto.netAlertMbps !== undefined) data.netAlertMbps = Math.max(0, Math.floor(Number(dto.netAlertMbps)));
    await this.prisma.settings.update({ where: { id: 'singleton' }, data });
    return this.getConfig();
  }

  private onCooldown(metric: string): boolean {
    const last = this.lastAlert.get(metric) ?? 0;
    return Date.now() - last < MonitorService.COOLDOWN_MS;
  }

  /** Eşikleri kontrol eder, aşılanlar için (soğuma dışında) uyarı gönderir. */
  async checkAndAlert(force = false): Promise<{ status: Awaited<ReturnType<MonitorService['getStatus']>>; alerted: string[] }> {
    const cfg = await this.getConfig();
    const status = await this.getStatus();
    const alerted: string[] = [];
    const checks: Array<[string, number, number]> = [
      ['CPU', status.cpu, cfg.cpuAlertPct],
      ['RAM', status.mem, cfg.memAlertPct],
      ['DISK', status.disk, cfg.diskAlertPct],
    ];
    if (cfg.netAlertMbps > 0) checks.push(['NET', Math.round(status.rxMbps + status.txMbps), cfg.netAlertMbps]);
    for (const [metric, value, threshold] of checks) {
      if (value < threshold) continue;
      if (!force && this.onCooldown(metric)) continue;
      this.lastAlert.set(metric, Date.now());
      alerted.push(metric);
      await this.sendAlert(metric, value, threshold).catch((e) =>
        this.logger.error(`sendAlert ${metric}: ${(e as Error).message}`),
      );
    }
    return { status, alerted };
  }

  private async sendAlert(metric: string, value: number, threshold: number): Promise<void> {
    const unit = metric === 'NET' ? ' Mbps' : '%';
    const title = `⚠️ Sistem uyarısı: ${metric} ${value}${unit}`;
    const body = `${metric}: ${value}${unit} (eşik ${threshold}${unit}).`;
    await this.notifications.sendDiscordAlert(title, body, 15158332).catch(() => {});
    await this.notifications.sendTelegramAlert(`⚠️ <b>${title}</b>\n${body}`).catch(() => {});
    await this.prisma.notificationLog
      .create({
        data: {
          type: 'SYSTEM_ALERT',
          recipient: 'admin',
          subject: body,
          messageKey: 'systemAlert',
          messageParams: { metric, value, threshold, unit: unit.trim() || '%' },
          status: 'SENT',
        },
      })
      .catch(() => {});
  }

  @Cron('*/5 * * * *')
  async scheduled(): Promise<void> {
    try {
      const cfg = await this.getConfig();
      if (!cfg.enabled) return;
      const r = await this.checkAndAlert(false);
      if (r.alerted.length) this.logger.warn(`System alert: ${r.alerted.join(', ')}`);
    } catch (err) {
      this.logger.error(`monitor scheduled: ${(err as Error).message}`);
    }
  }
}
