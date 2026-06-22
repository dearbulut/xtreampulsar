import { Injectable, Logger, Inject } from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── Fix Users Output ────────────────────────────────────────────────────────

  async fixUsersOutput(): Promise<{ fixed: number }> {
    // User model does not have an outputFormats field in the Prisma schema.
    return { fixed: 0 };
  }

  // ─── Streams to JSON ─────────────────────────────────────────────────────────

  async streamsToJson(
    streamType?: 'LIVE' | 'VOD' | 'SERIES' | 'ALL',
  ): Promise<Array<{ id: string; name: string; url: string; type: string; category: string }>> {
    try {
      const where =
        streamType && streamType !== 'ALL'
          ? { category: { type: streamType } }
          : {};

      const streams = await this.prisma.stream.findMany({
        where,
        include: { category: true },
      });

      return streams.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.primaryUrl,
        type: s.category.type,
        category: s.category.name,
      }));
    } catch (err) {
      this.logger.error(`streamsToJson: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Set Stream Server ───────────────────────────────────────────────────────

  async setStreamServer(
    serverId: string,
    streamIds: string[] | 'all',
    streamType: 'LIVE' | 'VOD' | 'SERIES' | 'ALL',
  ): Promise<{ updated: number }> {
    try {
      if (streamIds === 'all') {
        if (streamType === 'ALL') {
          const result = await this.prisma.stream.updateMany({
            data: { serverId },
          });
          return { updated: result.count };
        }

        // Filter by category type: find matching category ids first
        const categories = await this.prisma.category.findMany({
          where: { type: streamType },
          select: { id: true },
        });
        const categoryIds = categories.map((c) => c.id);

        const result = await this.prisma.stream.updateMany({
          where: { categoryId: { in: categoryIds } },
          data: { serverId },
        });
        return { updated: result.count };
      }

      // Update by explicit stream ids
      const result = await this.prisma.stream.updateMany({
        where: { id: { in: streamIds } },
        data: { serverId },
      });
      return { updated: result.count };
    } catch (err) {
      this.logger.error(`setStreamServer: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Clean Database ──────────────────────────────────────────────────────────

  async cleanDatabase(
    targets: string[],
  ): Promise<{ deleted: Record<string, number> }> {
    const deleted: Record<string, number> = {
      orphan_streams: 0,
      dead_connections: 0,
      old_logs: 0,
      empty_categories: 0,
      unused_epg: 0,
    };

    for (const target of targets) {
      try {
        switch (target) {
          case 'orphan_streams': {
            // Category is a required FK in the schema — orphan streams cannot exist
            // under normal FK constraints; return 0 safely.
            deleted.orphan_streams = 0;
            break;
          }

          case 'dead_connections': {
            const result = await this.prisma.connection.deleteMany({
              where: {
                startedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                endedAt: null,
              },
            });
            deleted.dead_connections = result.count;
            break;
          }

          case 'old_logs': {
            const result = await this.prisma.auditLog.deleteMany({
              where: {
                createdAt: {
                  lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            });
            deleted.old_logs = result.count;
            break;
          }

          case 'empty_categories': {
            const result = await this.prisma.category.deleteMany({
              where: { streams: { none: {} } },
            });
            deleted.empty_categories = result.count;
            break;
          }

          case 'unused_epg': {
            // Delete EPG channels that have no programmes
            const result = await this.prisma.ePGChannel.deleteMany({
              where: { programmes: { none: {} } },
            });
            deleted.unused_epg = result.count;
            break;
          }

          default:
            this.logger.warn(`cleanDatabase: unknown target "${target}"`);
        }
      } catch (err) {
        this.logger.error(
          `cleanDatabase [${target}]: ${(err as Error).message}`,
        );
      }
    }

    // Only return keys that were requested
    const filteredDeleted: Record<string, number> = {};
    for (const target of targets) {
      if (target in deleted) {
        filteredDeleted[target] = deleted[target];
      }
    }

    return { deleted: filteredDeleted };
  }

  // ─── Restart All Streams ─────────────────────────────────────────────────────

  async restartAllStreams(): Promise<{ restarted: number }> {
    try {
      const result = await this.prisma.stream.updateMany({
        where: { workerStatus: 'RUNNING' },
        data: { workerStatus: 'IDLE' },
      });
      return { restarted: result.count };
    } catch (err) {
      this.logger.error(`restartAllStreams: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Re-encode VODs ──────────────────────────────────────────────────────────

  async reencodeVods(opts: {
    categoryId?: string;
    serverId?: string;
    mode: 'all' | 'category' | 'by_server' | 'down_only' | 'ready_only';
  }): Promise<{ queued: number }> {
    try {
      let result: { count: number };

      switch (opts.mode) {
        case 'all': {
          // All VOD streams → IDLE
          const vodCategories = await this.prisma.category.findMany({
            where: { type: 'VOD' },
            select: { id: true },
          });
          const catIds = vodCategories.map((c) => c.id);
          result = await this.prisma.stream.updateMany({
            where: { categoryId: { in: catIds } },
            data: { workerStatus: 'IDLE' },
          });
          break;
        }

        case 'category': {
          result = await this.prisma.stream.updateMany({
            where: { categoryId: opts.categoryId },
            data: { workerStatus: 'IDLE' },
          });
          break;
        }

        case 'by_server': {
          const vodCategories = await this.prisma.category.findMany({
            where: { type: 'VOD' },
            select: { id: true },
          });
          const catIds = vodCategories.map((c) => c.id);
          result = await this.prisma.stream.updateMany({
            where: {
              serverId: opts.serverId,
              categoryId: { in: catIds },
            },
            data: { workerStatus: 'IDLE' },
          });
          break;
        }

        case 'down_only': {
          const vodCategories = await this.prisma.category.findMany({
            where: { type: 'VOD' },
            select: { id: true },
          });
          const catIds = vodCategories.map((c) => c.id);
          result = await this.prisma.stream.updateMany({
            where: {
              categoryId: { in: catIds },
              status: 'OFFLINE',
            },
            data: { workerStatus: 'IDLE' },
          });
          break;
        }

        case 'ready_only': {
          const vodCategories = await this.prisma.category.findMany({
            where: { type: 'VOD' },
            select: { id: true },
          });
          const catIds = vodCategories.map((c) => c.id);
          result = await this.prisma.stream.updateMany({
            where: {
              categoryId: { in: catIds },
              workerStatus: 'STOPPED',
            },
            data: { workerStatus: 'IDLE' },
          });
          break;
        }

        default:
          result = { count: 0 };
      }

      return { queued: result.count };
    } catch (err) {
      this.logger.error(`reencodeVods: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Bulk Series Import ──────────────────────────────────────────────────────

  async bulkSeriesImport(
    categoryId: string,
    folderPath: string,
    specialCharEncoding: boolean,
  ): Promise<{ found: number; imported: number; logs: string[] }> {
    const logs: string[] = [];
    let found = 0;
    let imported = 0;

    let entries: string[];
    try {
      entries = fs.readdirSync(folderPath);
    } catch (err) {
      logs.push(`Failed to read folder: ${(err as Error).message}`);
      return { found, imported, logs };
    }

    for (const dir of entries) {
      const dirPath = path.join(folderPath, dir);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(dirPath);
      } catch {
        continue;
      }

      if (!stat.isDirectory()) continue;

      let files: string[];
      try {
        files = fs.readdirSync(dirPath);
      } catch (err) {
        logs.push(`Skipping "${dir}": ${(err as Error).message}`);
        continue;
      }

      for (const file of files) {
        const filePath = path.join(dirPath, file);

        let fileStat: fs.Stats;
        try {
          fileStat = fs.statSync(filePath);
        } catch {
          continue;
        }

        if (!fileStat.isFile()) continue;

        found++;

        const rawName = `${dir} - ${file}`;
        const streamName = specialCharEncoding
          ? encodeURIComponent(rawName)
          : rawName;
        const primaryUrl = `file://${path.join(folderPath, dir, file)}`;

        try {
          await this.prisma.stream.create({
            data: {
              name: streamName,
              primaryUrl,
              categoryId,
            },
          });
          imported++;
          logs.push(`Imported: ${streamName}`);
        } catch (err) {
          logs.push(`Failed "${streamName}": ${(err as Error).message}`);
        }
      }
    }

    return { found, imported, logs };
  }

  // ─── System Stats ────────────────────────────────────────────────────────────

  private formatUptimeSeconds(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d} gün`);
    if (h > 0) parts.push(`${h} saat`);
    parts.push(`${m} dak`);
    return parts.join(' ');
  }

  async systemStats(): Promise<{
    cpuLoad: number;
    totalMemMb: number;
    freeMemMb: number;
    memUsedPct: number;
    runningWorkers: number;
    dbConnected: boolean;
    redisConnected: boolean;
    uptime: number;
    uptimeFormatted: string;
  }> {
    const cpuLoad = Math.min(
      100,
      (os.loadavg()[0] / os.cpus().length) * 100,
    );
    const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
    const memUsedPct = Math.round(
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
    );

    const runningWorkers = await this.prisma.stream.count({
      where: { workerStatus: 'RUNNING' },
    });

    let dbConnected = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    let redisConnected = false;
    try {
      const pong = await this.redis.ping();
      redisConnected = pong === 'PONG';
    } catch {
      redisConnected = false;
    }

    const uptime = Math.floor(process.uptime());

    return {
      cpuLoad,
      totalMemMb,
      freeMemMb,
      memUsedPct,
      runningWorkers,
      dbConnected,
      redisConnected,
      uptime,
      uptimeFormatted: this.formatUptimeSeconds(uptime),
    };
  }
}
