import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { StreamWorkerService } from './stream-worker.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class StreamHealthService {
  private readonly logger = new Logger(StreamHealthService.name);
  private readonly unhealthyCounts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workerService: StreamWorkerService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async probeAllStreams(): Promise<void> {
    const streams = await this.prisma.stream.findMany({
      where: { workerStatus: 'RUNNING' },
      select: { id: true },
    });

    await Promise.allSettled(streams.map((s) => this.probeStream(s.id)));
  }

  async probeStream(streamId: string): Promise<{ status: string; responseTime: number | null }> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: { id: true, name: true, primaryUrl: true, backupUrl: true },
    });
    if (!stream) return { status: 'UNKNOWN', responseTime: null };

    const url = stream.primaryUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { status: 'UNKNOWN', responseTime: null };
    }

    const start = Date.now();
    let status: 'HEALTHY' | 'UNHEALTHY' | 'TIMEOUT' = 'UNHEALTHY';
    let responseTime: number | null = null;

    try {
      const ok = await this.httpHead(url, 5000);
      responseTime = Date.now() - start;
      status = ok ? 'HEALTHY' : 'UNHEALTHY';
    } catch (err) {
      responseTime = Date.now() - start;
      status = (err as Error).message === 'timeout' ? 'TIMEOUT' : 'UNHEALTHY';
    }

    await this.prisma.streamHealthLog.create({
      data: { streamId, status, responseTime },
    });

    const uptimePercent = await this.calcUptimePercent(streamId);

    if (status === 'HEALTHY') {
      this.unhealthyCounts.delete(streamId);
      await this.prisma.stream.update({
        where: { id: streamId },
        data: { healthStatus: 'HEALTHY', lastHealthCheck: new Date(), uptimePercent },
      });
    } else {
      const count = (this.unhealthyCounts.get(streamId) ?? 0) + 1;
      this.unhealthyCounts.set(streamId, count);
      this.logger.warn(`Stream ${streamId} unhealthy (${count}/3)`);

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { healthStatus: 'UNHEALTHY', lastHealthCheck: new Date(), uptimePercent },
      });

      if (count >= 3) {
        this.unhealthyCounts.delete(streamId);
        this.logger.error(`Stream ${streamId} failed 3 health checks — restarting`);
        try {
          await this.workerService.restartWorker(streamId);
        } catch {
          await this.prisma.stream.update({
            where: { id: streamId },
            data: { workerStatus: 'CRASHED' },
          });
          await this.notificationService.notifyStreamDown(streamId, stream.name);
        }
      }
    }

    return { status, responseTime };
  }

  async getStreamHealth(streamId: string) {
    const [stream, logs] = await Promise.all([
      this.prisma.stream.findUnique({
        where: { id: streamId },
        select: { healthStatus: true, lastHealthCheck: true, uptimePercent: true },
      }),
      this.prisma.streamHealthLog.findMany({
        where: { streamId },
        orderBy: { checkedAt: 'desc' },
        take: 60,
      }),
    ]);

    const lastDowntime = logs.find((l) => l.status !== 'HEALTHY');

    return {
      streamId,
      healthStatus: stream?.healthStatus ?? 'UNKNOWN',
      lastHealthCheck: stream?.lastHealthCheck ?? null,
      uptimePercent: stream?.uptimePercent ?? 100,
      lastDowntime: lastDowntime?.checkedAt ?? null,
      recentLogs: logs.slice(0, 10),
    };
  }

  async getHealthSummary() {
    const [healthy, unhealthy, totalRunning] = await Promise.all([
      this.prisma.stream.count({ where: { workerStatus: 'RUNNING', healthStatus: 'HEALTHY' } }),
      this.prisma.stream.count({ where: { workerStatus: 'RUNNING', healthStatus: 'UNHEALTHY' } }),
      this.prisma.stream.count({ where: { workerStatus: 'RUNNING' } }),
    ]);
    return {
      healthy,
      unhealthy,
      unknown: totalRunning - healthy - unhealthy,
      total: totalRunning,
    };
  }

  private httpHead(url: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https://') ? https : http;
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error('timeout'));
      }, timeoutMs);

      const req = mod.request(url, { method: 'HEAD' }, (res) => {
        clearTimeout(timer);
        res.resume();
        const sc = res.statusCode ?? 0;
        resolve(sc >= 200 && sc < 400);
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      req.end();
    });
  }

  private async calcUptimePercent(streamId: string): Promise<number> {
    const logs = await this.prisma.streamHealthLog.findMany({
      where: { streamId },
      orderBy: { checkedAt: 'desc' },
      take: 100,
    });
    if (logs.length === 0) return 100;
    const healthy = logs.filter((l) => l.status === 'HEALTHY').length;
    return Math.round((healthy / logs.length) * 1000) / 10;
  }
}
