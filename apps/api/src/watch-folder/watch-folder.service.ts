import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MetadataService } from '../metadata/metadata.service';

const VIDEO_EXT = new Set(['mp4', 'mkv', 'avi', 'mov', 'm4v', 'webm', 'ts']);
const MAX_FILES_PER_SCAN = 500;
const JUNK = /\b(1080p|720p|480p|2160p|4k|uhd|x264|x265|h264|h265|hevc|web[- ]?dl|webrip|bluray|blu[- ]?ray|hdrip|brrip|bdrip|dvdrip|hdtv|aac|ac3|dts|dd5\.?1|10bit|remux|proper|repack|imax|hdr|multi|dual)\b/gi;

interface ParsedName {
  kind: 'MOVIE' | 'EPISODE';
  title: string;
  season?: number;
  episode?: number;
  ext: string;
}

interface WatchConfig {
  enabled: boolean;
  path: string | null;
  bouquetId: string | null;
  intervalMins: number;
}

type Db = PrismaService & {
  watchImport: {
    findMany: (a?: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (a: unknown) => Promise<{ id: string }>;
    update: (a: unknown) => Promise<unknown>;
    count: (a?: unknown) => Promise<number>;
  };
};

@Injectable()
export class WatchFolderService {
  private readonly logger = new Logger(WatchFolderService.name);
  private readonly db: Db;
  private scanning = false;
  private lastScan = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metadata: MetadataService,
  ) {
    this.db = prisma as unknown as Db;
  }

  async getConfig(): Promise<WatchConfig> {
    const s = (await this.prisma.settings.findUnique({ where: { id: 'singleton' } })) as unknown as {
      watchFolderEnabled?: boolean; watchFolderPath?: string | null; watchFolderBouquetId?: string | null; watchFolderIntervalMins?: number;
    } | null;
    return {
      enabled: s?.watchFolderEnabled ?? false,
      path: s?.watchFolderPath ?? null,
      bouquetId: s?.watchFolderBouquetId ?? null,
      intervalMins: s?.watchFolderIntervalMins ?? 5,
    };
  }

  async updateConfig(dto: Partial<{ enabled: boolean; path: string; bouquetId: string; intervalMins: number }>) {
    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.watchFolderEnabled = dto.enabled;
    if (dto.path !== undefined) data.watchFolderPath = dto.path.trim() || null;
    if (dto.bouquetId !== undefined) data.watchFolderBouquetId = dto.bouquetId || null;
    if (dto.intervalMins !== undefined) data.watchFolderIntervalMins = Math.max(1, dto.intervalMins);
    await this.prisma.settings.update({
      where: { id: 'singleton' },
      data: data as Parameters<typeof this.prisma.settings.update>[0]['data'],
    });
    return this.getConfig();
  }

  imports(limit = 100) {
    return this.db.watchImport.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  @Cron('*/5 * * * *')
  async scheduled(): Promise<void> {
    const cfg = await this.getConfig();
    if (!cfg.enabled || !cfg.path) return;
    if (Date.now() - this.lastScan < cfg.intervalMins * 60_000) return;
    await this.scanNow().catch((e) => this.logger.warn(`scheduled scan failed: ${(e as Error).message}`));
  }

  async scanNow(): Promise<{ scanned: number; imported: number; skipped: number; errors: number }> {
    if (this.scanning) return { scanned: 0, imported: 0, skipped: 0, errors: 0 };
    this.scanning = true;
    this.lastScan = Date.now();
    const stats = { scanned: 0, imported: 0, skipped: 0, errors: 0 };
    try {
      const cfg = await this.getConfig();
      if (!cfg.path) return stats;
      if (!fs.existsSync(cfg.path)) {
        this.logger.warn(`watch folder yok: ${cfg.path}`);
        return stats;
      }
      const bouquetId = cfg.bouquetId ?? (await this.getOrCreateDefaultBouquet());

      const known = new Set<string>();
      for (const w of await this.db.watchImport.findMany({ select: { path: true } })) known.add(String(w.path));

      const files: string[] = [];
      this.walk(cfg.path, files, 0);
      const base = (process.env.SERVER_URL ?? 'http://localhost').replace(/\/+$/, '');
      const seriesCache = new Map<string, string>();

      for (const fp of files) {
        if (stats.imported >= MAX_FILES_PER_SCAN) break;
        if (known.has(fp)) continue;
        stats.scanned++;
        const parsed = this.parseName(path.basename(fp));
        try {
          if (parsed.kind === 'EPISODE') {
            await this.importEpisode(fp, parsed, bouquetId, base, seriesCache);
          } else {
            await this.importMovie(fp, parsed, bouquetId, base);
          }
          stats.imported++;
        } catch (e) {
          stats.errors++;
          await this.record(fp, parsed, 'ERROR', (e as Error).message).catch(() => undefined);
        }
        known.add(fp);
      }
      this.logger.log(`watch scan: ${stats.imported} imported, ${stats.errors} errors`);
      return stats;
    } finally {
      this.scanning = false;
    }
  }

  private walk(dir: string, out: string[], depth: number): void {
    if (depth > 6 || out.length > 5000) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        this.walk(full, out, depth + 1);
      } else if (e.isFile()) {
        const ext = (e.name.split('.').pop() ?? '').toLowerCase();
        if (VIDEO_EXT.has(ext)) out.push(full);
      }
    }
  }

  private clean(t: string): string {
    return t.replace(JUNK, ' ').replace(/[\[\](){}]/g, ' ').replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  parseName(filename: string): ParsedName {
    const ext = (filename.split('.').pop() ?? 'mp4').toLowerCase();
    const bare = filename.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ');
    const se = /^(.*?)[ ._-]*[sS](\d{1,2})[ ._-]*[eE](\d{1,3})/.exec(bare) || /^(.*?)[ ._-]+(\d{1,2})x(\d{1,3})/.exec(bare);
    if (se) {
      return { kind: 'EPISODE', title: this.clean(se[1]) || 'Series', season: Number(se[2]), episode: Number(se[3]), ext };
    }
    const ym = /(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/.exec(bare);
    let title = bare;
    if (ym && ym.index > 0) title = bare.slice(0, ym.index);
    return { kind: 'MOVIE', title: this.clean(title) || this.clean(bare) || 'Movie', ext };
  }

  private async ensureCategory(name: string, type: 'VOD' | 'SERIES', bouquetId: string): Promise<string> {
    const found = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
    if (found) return found.id;
    const created = await this.prisma.category.create({ data: { name, type, bouquetId }, select: { id: true } });
    return created.id;
  }

  private async importMovie(fp: string, p: ParsedName, bouquetId: string, base: string): Promise<void> {
    const categoryId = await this.ensureCategory('Watch Folder — Movies', 'VOD', bouquetId);
    const rec = await this.record(fp, p, 'OK', null);
    const primaryUrl = `${base}/api/v1/watch-media/${rec.id}`;
    const stream = await this.prisma.stream.create({
      data: { name: p.title, primaryUrl, streamMode: 'PROXY', categoryId },
      select: { id: true },
    });
    await this.db.watchImport.update({ where: { id: rec.id }, data: { streamId: stream.id } });
    void this.metadata.enrichVod(stream.id).catch(() => undefined);
  }

  private async importEpisode(fp: string, p: ParsedName, bouquetId: string, base: string, cache: Map<string, string>): Promise<void> {
    const categoryId = await this.ensureCategory('Watch Folder — Series', 'SERIES', bouquetId);
    const key = p.title.toLowerCase();
    let seriesId = cache.get(key);
    if (!seriesId) {
      const existing = await this.prisma.stream.findFirst({ where: { name: p.title, categoryId }, select: { id: true } });
      if (existing) {
        seriesId = existing.id;
      } else {
        const created = await this.prisma.stream.create({
          data: { name: p.title, primaryUrl: '', streamMode: 'PROXY', categoryId },
          select: { id: true },
        });
        seriesId = created.id;
        void this.metadata.enrichSeries(seriesId).catch(() => undefined);
      }
      cache.set(key, seriesId);
    }
    const rec = await this.record(fp, p, 'OK', null);
    const primaryUrl = `${base}/api/v1/watch-media/${rec.id}`;
    const ep = await this.prisma.episode.upsert({
      where: { seriesId_season_episode: { seriesId, season: p.season ?? 1, episode: p.episode ?? 1 } },
      update: { primaryUrl, containerExtension: p.ext },
      create: { seriesId, season: p.season ?? 1, episode: p.episode ?? 1, primaryUrl, containerExtension: p.ext, title: `S${p.season}E${p.episode}` },
      select: { id: true },
    });
    await this.db.watchImport.update({ where: { id: rec.id }, data: { episodeId: ep.id, streamId: seriesId } });
  }

  private async record(fp: string, p: ParsedName, status: string, message: string | null) {
    return this.db.watchImport.create({
      data: {
        path: fp,
        kind: p.kind,
        title: p.title,
        season: p.season ?? null,
        episode: p.episode ?? null,
        status,
        message: message ? message.slice(0, 300) : null,
      },
    });
  }

  private async getOrCreateDefaultBouquet(): Promise<string> {
    const existing = await this.prisma.bouquet.findFirst({ where: { name: 'Default' }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.bouquet.create({ data: { name: 'Default' }, select: { id: true } });
    return created.id;
  }
}
