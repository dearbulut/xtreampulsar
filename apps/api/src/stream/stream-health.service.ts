import * as http from 'http';
import * as https from 'https';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StreamWorkerService } from './stream-worker.service';
import { NotificationService } from '../notification/notification.service';

type HealthStatus = 'up' | 'down' | 'degraded';

/** Kaynak yoklarken kullanilan varsayilan User-Agent. Cogu IPTV kaynagi bos ya
 *  da bilinmeyen UA'yi reddeder; akisin kendi streamUserAgent'i varsa o kazanir. */
const DEFAULT_PROBE_UA =
  process.env.HEALTH_PROBE_USER_AGENT || 'VLC/3.0.20 LibVLC/3.0.20';

/** Kaynak yoklamasinda kullanilan, akis duzeyi upstream ayarlari. */
interface ProbeAuth {
  streamUserAgent?: string | null;
  httpHeaders?: string | null;
  httpCookie?: string | null;
}

@Injectable()
export class StreamHealthService {
  private readonly logger = new Logger(StreamHealthService.name);
  private readonly failureCounts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerService: StreamWorkerService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('*/5 * * * *')
  async checkAllStreams(): Promise<void> {
    const streams = await this.prisma.stream.findMany({
      where: { isActive: true, category: { type: 'LIVE' } },
      select: { id: true },
    });
    const batches = this.chunk(streams, 50);
    for (const batch of batches) {
      await Promise.allSettled(batch.map((s) => this.checkStream(s.id)));
    }
  }

  async checkStream(streamId: string): Promise<{ status: HealthStatus; responseTime: number | null }> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        name: true,
        primaryUrl: true,
        streamMode: true,
        streamUserAgent: true,
        httpHeaders: true,
        httpCookie: true,
      },
    });
    if (!stream) return { status: 'down', responseTime: null };

    const url = stream.primaryUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { status: 'down', responseTime: null };
    }

    const start = Date.now();
    let status: HealthStatus = 'down';
    let responseTime: number | null = null;
    let errorMessage: string | undefined;

    try {
      const { ok, statusCode } = await this.probeSource(url, 5000, stream);
      responseTime = Date.now() - start;
      if (ok) {
        status = responseTime > 3000 ? 'degraded' : 'up';
      } else {
        status = 'down';
        errorMessage = `HTTP ${statusCode ?? 0}`;
      }
    } catch (err) {
      responseTime = Date.now() - start;
      status = 'down';
      errorMessage = (err as Error).message;
    }

    await this.prisma.streamHealthLog.create({
      data: { streamId, status, responseTime, errorMessage },
    });

    const uptimePercent = await this.computeUptimePercent(streamId);
    const healthStatus = status === 'up' ? 'HEALTHY' : 'UNHEALTHY';

    if (status === 'up') {
      this.failureCounts.delete(streamId);
      await this.prisma.stream.update({
        where: { id: streamId },
        data: { healthStatus, lastHealthCheck: new Date(), uptimePercent, lastError: null },
      });
    } else {
      const count = (this.failureCounts.get(streamId) ?? 0) + 1;
      this.failureCounts.set(streamId, count);
      this.logger.warn(`Stream ${stream.name} ${status} (${count}/3): ${errorMessage ?? ''}`);

      const confirmedDown = count >= 3;
      await this.prisma.stream.update({
        where: { id: streamId },
        data: {
          ...(confirmedDown ? { healthStatus: 'UNHEALTHY' } : {}),
          lastHealthCheck: new Date(),
          uptimePercent,
          lastError: errorMessage ?? null,
        },
      });

      if (confirmedDown) {
        this.failureCounts.delete(streamId);
        // PROXY stream'in FFmpeg worker'ı YOK — restart anlamsız (gereksiz FFmpeg
        // spawn + exit 255 döngüsü yaratırdı). Sağlık zaten UNHEALTHY işaretlendi;
        // upstream gerçekten erişilemiyorsa bildirim gönder.
        if ((stream.streamMode ?? 'PROXY') === 'PROXY') {
          this.logger.warn(`PROXY stream ${stream.name} 3 kez erişilemedi (worker restart atlandı)`);
          await this.notificationService.notifyStreamDown(streamId, stream.name).catch(() => {});
        } else if (this.workerService.getWorkerStats(streamId).running) {
          // Saglik kontrolu kaynaga DISARIDAN bakar; worker'in kendisi hala
          // ayakta olabilir (kaynak tarafi UA/IP filtresi, gecici 5xx, CDN
          // hiccup). Calisan bir FFmpeg'i oldurmek yayini gercekten bozar ve
          // "Running / 00h 00m 11s" restart dongusune sokar. Bu yuzden sadece
          // isaretle + bildir, sureci elleme.
          this.logger.warn(
            `Stream ${stream.name} 3 saglik kontrolunu gecemedi ama FFmpeg worker calisiyor — restart atlandi`,
          );
          await this.notificationService.notifyStreamDown(streamId, stream.name).catch(() => {});
        } else {
          this.logger.error(`Stream ${stream.name} failed 3 checks — restarting`);
          try {
            await this.workerService.restartWorker(streamId);
          } catch {
            await this.prisma.stream.update({ where: { id: streamId }, data: { workerStatus: 'CRASHED' } });
            await this.notificationService.notifyStreamDown(streamId, stream.name);
          }
        }
      }
    }

    return { status, responseTime };
  }

  // Kept for backward-compat with POST :id/probe endpoint
  async probeStream(streamId: string) {
    const result = await this.checkStream(streamId);
    return { status: result.status, responseTime: result.responseTime };
  }

  async getStreamHealth(streamId: string, hours = 24) {
    const since = new Date(Date.now() - hours * 3600_000);

    const [stream, logs] = await Promise.all([
      this.prisma.stream.findUnique({
        where: { id: streamId },
        select: { healthStatus: true, lastHealthCheck: true, uptimePercent: true, lastError: true },
      }),
      this.prisma.streamHealthLog.findMany({
        where: { streamId, checkedAt: { gte: since } },
        orderBy: { checkedAt: 'desc' },
        take: 1000,
      }),
    ]);

    const totalChecks = logs.length;
    const upCount = logs.filter((l) => l.status === 'up').length;
    const downCount = logs.filter((l) => l.status === 'down').length;
    const degradedCount = logs.filter((l) => l.status === 'degraded').length;
    const responseTimes = logs.map((l) => l.responseTime).filter((t): t is number => t !== null);
    const avgResponseTime = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
    const uptimePercent = totalChecks > 0 ? Math.round((upCount / totalChecks) * 1000) / 10 : 100;

    return {
      streamId,
      healthStatus: stream?.healthStatus ?? 'UNKNOWN',
      lastHealthCheck: stream?.lastHealthCheck ?? null,
      lastError: stream?.lastError ?? null,
      uptimePercent,
      totalChecks,
      upCount,
      downCount,
      degradedCount,
      avgResponseTime,
      recentLogs: logs.slice(0, 20),
      chartData: this.buildChartData(logs, since, hours),
    };
  }

  async getHealthSummary() {
    const since = new Date(Date.now() - 24 * 3600_000);

    const [healthyCnt, unhealthyCnt, totalRunning, topDown] = await Promise.all([
      this.prisma.stream.count({ where: { isActive: true, healthStatus: 'HEALTHY' } }),
      this.prisma.stream.count({ where: { isActive: true, healthStatus: 'UNHEALTHY' } }),
      this.prisma.stream.count({ where: { isActive: true } }),
      this.prisma.stream.findMany({
        where: { isActive: true, healthStatus: 'UNHEALTHY' },
        select: { id: true, name: true, uptimePercent: true, lastError: true, lastHealthCheck: true },
        orderBy: { uptimePercent: 'asc' },
        take: 10,
      }),
    ]);

    const recentLogs = await this.prisma.streamHealthLog.groupBy({
      by: ['status'],
      where: { checkedAt: { gte: since } },
      _count: { _all: true },
    });

    const countByStatus = Object.fromEntries(recentLogs.map((r) => [r.status, r._count._all]));

    return {
      healthy: healthyCnt,
      unhealthy: unhealthyCnt,
      unknown: totalRunning - healthyCnt - unhealthyCnt,
      total: totalRunning,
      last24h: {
        up: countByStatus['up'] ?? 0,
        down: countByStatus['down'] ?? 0,
        degraded: countByStatus['degraded'] ?? 0,
      },
      topDownStreams: topDown,
    };
  }

  private buildChartData(
    logs: Array<{ status: string; responseTime: number | null; checkedAt: Date }>,
    since: Date,
    hours: number,
  ) {
    const bucketMs = hours <= 24 ? 5 * 60_000 : 30 * 60_000;
    const buckets = new Map<number, { up: number; total: number; avgRt: number[] }>();

    for (const log of logs) {
      const bucket = Math.floor(log.checkedAt.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucket)) buckets.set(bucket, { up: 0, total: 0, avgRt: [] });
      const b = buckets.get(bucket)!;
      b.total++;
      if (log.status === 'up' || log.status === 'degraded') b.up++;
      if (log.responseTime !== null) b.avgRt.push(log.responseTime);
    }

    const now = Date.now();
    const points = [];
    for (let t = Math.floor(since.getTime() / bucketMs) * bucketMs; t <= now; t += bucketMs) {
      const b = buckets.get(t);
      points.push({
        time: new Date(t).toISOString(),
        uptime: b ? Math.round((b.up / b.total) * 100) : null,
        responseTime: b?.avgRt.length ? Math.round(b.avgRt.reduce((a, x) => a + x, 0) / b.avgRt.length) : null,
      });
    }
    return points;
  }

  private async computeUptimePercent(streamId: string): Promise<number> {
    const logs = await this.prisma.streamHealthLog.findMany({
      where: { streamId },
      orderBy: { checkedAt: 'desc' },
      take: 100,
    });
    if (logs.length === 0) return 100;
    const up = logs.filter((l) => l.status === 'up' || l.status === 'HEALTHY').length;
    return Math.round((up / logs.length) * 1000) / 10;
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /** "K: V" satirlarini header nesnesine cevirir. */
  private static parseHeaderLines(raw?: string | null): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of (raw ?? '').split(/\r?\n/)) {
      const t = line.trim();
      const i = t.indexOf(':');
      if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return out;
  }

  /**
   * Kaynagi bir oynatici gibi yoklar.
   *
   * Eskiden burada ciplak bir HTTP HEAD vardi ve akisin kendi upstream
   * ayarlari (User-Agent / ek header / cookie) hic gonderilmiyordu. IPTV
   * kaynaklarinin cogu HEAD'i ya da bilinmeyen UA'yi reddeder; bu yuzden
   * calisan yayinlar "HTTP 403/502 — down" olarak isaretleniyordu (sahte
   * negatif). Artik akisin kendi basliklariyla `Range: bytes=0-1` GET
   * gonderiyoruz ve yanit basligi gelir gelmez baglantiyi kapatiyoruz —
   * canli akis indirilmez.
   */
  private probeSource(
    url: string,
    timeoutMs: number,
    auth: ProbeAuth,
  ): Promise<{ ok: boolean; statusCode?: number }> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https://') ? https : http;
      const headers: Record<string, string> = {
        Accept: '*/*',
        Range: 'bytes=0-1',
        ...StreamHealthService.parseHeaderLines(auth.httpHeaders),
      };
      headers['User-Agent'] = auth.streamUserAgent?.trim() || DEFAULT_PROBE_UA;
      const cookie = auth.httpCookie?.trim();
      if (cookie) headers.Cookie = cookie;

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(
        () => finish(() => { req.destroy(); reject(new Error('timeout')); }),
        timeoutMs,
      );

      const req = mod.request(url, { method: 'GET', headers }, (res) => {
        const sc = res.statusCode ?? 0;
        // Canli akisi indirmeden kes; res.resume() sonsuza kadar okurdu.
        res.destroy();
        finish(() => resolve({ ok: sc >= 200 && sc < 400, statusCode: sc }));
      });
      req.on('error', (err) => finish(() => reject(err)));
      req.end();
    });
  }
}
