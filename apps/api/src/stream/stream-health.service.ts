import * as http from 'http';
import * as https from 'https';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StreamWorkerService } from './stream-worker.service';
import { NotificationService } from '../notification/notification.service';

type HealthStatus = 'up' | 'down' | 'degraded';

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
      select: { id: true, name: true, primaryUrl: true, streamMode: true },
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
      const { ok, statusCode } = await this.httpHead(url, 5000);
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

  private httpHead(url: string, timeoutMs: number): Promise<{ ok: boolean; statusCode?: number }> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https://') ? https : http;
      const timer = setTimeout(() => { req.destroy(); reject(new Error('timeout')); }, timeoutMs);
      const req = mod.request(url, { method: 'HEAD' }, (res) => {
        clearTimeout(timer);
        res.resume();
        const sc = res.statusCode ?? 0;
        resolve({ ok: sc >= 200 && sc < 400, statusCode: sc });
      });
      req.on('error', (err) => { clearTimeout(timer); reject(err); });
      req.end();
    });
  }
}
