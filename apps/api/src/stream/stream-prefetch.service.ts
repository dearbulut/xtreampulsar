import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const CACHE_BASE = '/tmp/xtreampulsar/cache';
const MAX_CONCURRENT = 5;
const SEGMENT_STALE_MS = 30 * 60 * 1000;

@Injectable()
export class StreamPrefetchService {
  private readonly logger = new Logger(StreamPrefetchService.name);
  private prefetching = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  prefetchSegments(streamId: string, count = 3): void {
    if (this.prefetching.size >= MAX_CONCURRENT) return;
    if (this.prefetching.has(streamId)) return;

    this.prefetching.add(streamId);
    void this._doFetch(streamId, count).finally(() => this.prefetching.delete(streamId));
  }

  private async _doFetch(streamId: string, count: number): Promise<void> {
    const hlsBase = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
    const hlsDir = path.join(hlsBase, streamId);
    const cacheDir = path.join(CACHE_BASE, streamId);

    if (!fs.existsSync(hlsDir)) return;

    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch { return; }

    const m3u8 = path.join(hlsDir, 'index.m3u8');
    if (!fs.existsSync(m3u8)) return;

    const lines = fs.readFileSync(m3u8, 'utf-8').split('\n');
    const segments = lines.filter((l) => l.trim() && !l.startsWith('#')).slice(0, count);

    await Promise.all(
      segments.map(async (seg) => {
        const src = path.join(hlsDir, seg.trim());
        const dst = path.join(cacheDir, seg.trim());
        if (fs.existsSync(dst)) return;
        try {
          if (src.startsWith('http')) {
            await this._downloadFile(src, dst);
          } else if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
          }
        } catch (err) {
          this.logger.debug(`Prefetch failed for ${seg}: ${(err as Error).message}`);
        }
      }),
    );
  }

  private _downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      client.get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      }).on('error', (err) => {
        fs.unlink(dest, () => undefined);
        reject(err);
      });
    });
  }

  getCachedSegmentPath(streamId: string, segment: string): string | null {
    const p = path.join(CACHE_BASE, streamId, segment);
    return fs.existsSync(p) ? p : null;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async maintainPrefetch(): Promise<void> {
    const streams = await this.prisma.stream.findMany({
      where: { status: 'ONLINE', isActive: true },
      take: MAX_CONCURRENT,
      select: { id: true },
    });

    for (const s of streams) {
      this.prefetchSegments(s.id, 3);
    }

    this._cleanStaleCache();
  }

  private _cleanStaleCache(): void {
    if (!fs.existsSync(CACHE_BASE)) return;
    const now = Date.now();
    try {
      for (const dir of fs.readdirSync(CACHE_BASE)) {
        const dirPath = path.join(CACHE_BASE, dir);
        for (const file of fs.readdirSync(dirPath)) {
          const fp = path.join(dirPath, file);
          try {
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > SEGMENT_STALE_MS) fs.unlinkSync(fp);
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }
}
