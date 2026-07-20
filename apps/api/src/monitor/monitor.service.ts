import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as os from 'os';
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

  /** Anlık kaynak durumu. */
  async getStatus() {
    const [cpu, disk] = await Promise.all([this.cpuPercent(), this.diskPercent()]);
    return {
      cpu,
      mem: this.memPercent(),
      disk,
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
      select: { sysMonitorEnabled: true, cpuAlertPct: true, memAlertPct: true, diskAlertPct: true },
    });
    return { enabled: s.sysMonitorEnabled, cpuAlertPct: s.cpuAlertPct, memAlertPct: s.memAlertPct, diskAlertPct: s.diskAlertPct };
  }

  async updateConfig(dto: { enabled?: boolean; cpuAlertPct?: number; memAlertPct?: number; diskAlertPct?: number }) {
    const clamp = (n: number) => Math.max(1, Math.min(100, Math.floor(Number(n))));
    const data: { sysMonitorEnabled?: boolean; cpuAlertPct?: number; memAlertPct?: number; diskAlertPct?: number } = {};
    if (dto.enabled !== undefined) data.sysMonitorEnabled = Boolean(dto.enabled);
    if (dto.cpuAlertPct !== undefined) data.cpuAlertPct = clamp(dto.cpuAlertPct);
    if (dto.memAlertPct !== undefined) data.memAlertPct = clamp(dto.memAlertPct);
    if (dto.diskAlertPct !== undefined) data.diskAlertPct = clamp(dto.diskAlertPct);
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
    const title = `⚠️ Sistem uyarısı: ${metric} %${value}`;
    const body = `${metric} kullanımı %${value} (eşik %${threshold}).`;
    await this.notifications.sendDiscordAlert(title, body, 15158332).catch(() => {});
    await this.notifications.sendTelegramAlert(`⚠️ <b>${title}</b>\n${body}`).catch(() => {});
    // Panel zili için i18n'li kayıt
    await this.prisma.notificationLog
      .create({
        data: {
          type: 'SYSTEM_ALERT',
          recipient: 'admin',
          subject: body,
          messageKey: 'systemAlert',
          messageParams: { metric, value, threshold },
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
