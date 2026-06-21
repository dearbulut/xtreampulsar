import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { ImportM3uDto } from './dto/import-m3u.dto';
import { ImportXtreamDto } from './dto/import-xtream.dto';

interface M3uEntry {
  name: string;
  logo: string;
  groupTitle: string;
  tvgId: string;
  url: string;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Job list / status ─────────────────────────────────────────────────────

  findAllJobs() {
    return this.prisma.migrationJob.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findJob(id: string) {
    const job = await this.prisma.migrationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`MigrationJob ${id} not found`);
    return job;
  }

  async cancelJob(id: string) {
    const job = await this.findJob(id);
    if (job.status !== 'PENDING' && job.status !== 'RUNNING') return job;
    return this.prisma.migrationJob.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── M3U preview ──────────────────────────────────────────────────────────

  previewM3u(fileBuffer: Buffer): { entries: M3uEntry[]; total: number } {
    const lines = fileBuffer.toString('utf-8').split('\n');
    const entries = this.parseM3uLines(lines);
    return { entries: entries.slice(0, 20), total: entries.length };
  }

  // ─── M3U import ──────────────────────────────────────────────────────────

  async importM3u(fileBuffer: Buffer, dto: ImportM3uDto): Promise<{ jobId: string }> {
    const lines = fileBuffer.toString('utf-8').split('\n');
    const entries = this.parseM3uLines(lines);

    const job = await this.prisma.migrationJob.create({
      data: {
        source: 'M3U',
        status: 'PENDING',
        totalRecords: entries.length,
      },
    });

    if (!dto.dryRun) {
      void this.runM3uImport(job.id, entries, dto);
    } else {
      await this.prisma.migrationJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', processedRecords: entries.length },
      });
    }

    return { jobId: job.id };
  }

  private async runM3uImport(jobId: string, entries: M3uEntry[], dto: ImportM3uDto): Promise<void> {
    await this.prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];
    const categoryType = (dto.defaultType ?? 'LIVE') as 'LIVE' | 'VOD' | 'SERIES';

    const categoryMap = new Map<string, string>();

    const ensureCategory = async (name: string): Promise<string> => {
      if (categoryMap.has(name)) return categoryMap.get(name)!;

      let cat = await this.prisma.category.findFirst({
        where: { name, type: categoryType },
        select: { id: true },
      });

      if (!cat) {
        const bouquetId = dto.defaultBouquetId ?? await this.getOrCreateDefaultBouquet();
        cat = await this.prisma.category.create({
          data: { name, type: categoryType, bouquetId },
          select: { id: true },
        });
      }

      categoryMap.set(name, cat.id);
      return cat.id;
    };

    for (const entry of entries) {
      try {
        const categoryId = await ensureCategory(entry.groupTitle || 'Uncategorized');
        const existing = await this.prisma.stream.findFirst({
          where: { primaryUrl: entry.url, categoryId },
          select: { id: true },
        });

        if (existing) {
          await this.prisma.stream.update({
            where: { id: existing.id },
            data: { name: entry.name, tvgId: entry.tvgId || null, tvgLogo: entry.logo || null },
          });
        } else {
          await this.prisma.stream.create({
            data: {
              name: entry.name,
              primaryUrl: entry.url,
              tvgId: entry.tvgId || null,
              tvgLogo: entry.logo || null,
              categoryId,
            },
          });
        }
        processed++;
      } catch (err) {
        failed++;
        errors.push(`${entry.name}: ${(err as Error).message}`);
      }
    }

    await this.prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: failed === entries.length ? 'FAILED' : 'COMPLETED',
        processedRecords: processed,
        failedRecords: failed,
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
        completedAt: new Date(),
      },
    });

    this.logger.log(`M3U import ${jobId}: ${processed} ok, ${failed} failed`);
  }

  // ─── Xtream API import ────────────────────────────────────────────────────

  async importXtream(dto: ImportXtreamDto): Promise<{ jobId: string }> {
    const job = await this.prisma.migrationJob.create({
      data: { source: 'XTREAM_API', status: 'PENDING' },
    });

    if (!dto.dryRun) {
      void this.runXtreamImport(job.id, dto);
    } else {
      await this.prisma.migrationJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED' },
      });
    }

    return { jobId: job.id };
  }

  private async runXtreamImport(jobId: string, dto: ImportXtreamDto): Promise<void> {
    await this.prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const base = `${dto.serverUrl}/player_api.php?username=${encodeURIComponent(dto.username)}&password=${encodeURIComponent(dto.password)}`;

      let totalImported = 0;

      if (dto.importLive) {
        const [cats, streams] = await Promise.all([
          this.fetchJson<{ category_id: string; category_name: string }[]>(`${base}&action=get_live_categories`),
          this.fetchJson<{ name: string; stream_id: number; category_id: string; stream_icon: string; epg_channel_id: string }[]>(`${base}&action=get_live_streams`),
        ]);

        const catIdMap = await this.importXtreamCategories(cats, 'LIVE');
        totalImported += await this.importXtreamStreams(streams, catIdMap, dto.serverUrl);
      }

      if (dto.importVod) {
        const [cats, streams] = await Promise.all([
          this.fetchJson<{ category_id: string; category_name: string }[]>(`${base}&action=get_vod_categories`),
          this.fetchJson<{ name: string; stream_id: number; category_id: string; stream_icon: string }[]>(`${base}&action=get_vod_streams`),
        ]);

        const catIdMap = await this.importXtreamCategories(cats, 'VOD');
        totalImported += await this.importXtreamStreams(streams, catIdMap, dto.serverUrl);
      }

      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          totalRecords: totalImported,
          processedRecords: totalImported,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Xtream import ${jobId} failed: ${(err as Error).message}`);
      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errors: [(err as Error).message],
          completedAt: new Date(),
        },
      });
    }
  }

  private async importXtreamCategories(
    cats: { category_id: string; category_name: string }[],
    type: 'LIVE' | 'VOD' | 'SERIES',
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const defaultBouquetId = await this.getOrCreateDefaultBouquet();

    for (const cat of cats) {
      const existing = await this.prisma.category.findFirst({
        where: { name: cat.category_name, type },
        select: { id: true },
      });

      if (existing) {
        map.set(cat.category_id, existing.id);
      } else {
        const created = await this.prisma.category.create({
          data: { name: cat.category_name, type, bouquetId: defaultBouquetId },
          select: { id: true },
        });
        map.set(cat.category_id, created.id);
      }
    }

    return map;
  }

  private async importXtreamStreams(
    streams: { name: string; stream_id: number; category_id: string; stream_icon?: string; epg_channel_id?: string }[],
    catIdMap: Map<string, string>,
    _serverUrl: string,
  ): Promise<number> {
    let count = 0;

    for (const s of streams) {
      const categoryId = catIdMap.get(s.category_id);
      if (!categoryId) continue;

      const primaryUrl = `stream_placeholder_${s.stream_id}`;

      try {
        await this.prisma.stream.upsert({
          where: { externalId: s.stream_id },
          create: {
            externalId: s.stream_id,
            name: s.name,
            primaryUrl,
            tvgLogo: s.stream_icon || null,
            tvgId: s.epg_channel_id || null,
            categoryId,
          },
          update: {
            name: s.name,
            tvgLogo: s.stream_icon || null,
            tvgId: s.epg_channel_id || null,
            categoryId,
          },
        });
        count++;
      } catch {
        // skip duplicates
      }
    }

    return count;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getOrCreateDefaultBouquet(): Promise<string> {
    let bouquet = await this.prisma.bouquet.findFirst({
      where: { name: 'Default' },
      select: { id: true },
    });

    if (!bouquet) {
      bouquet = await this.prisma.bouquet.create({
        data: { name: 'Default' },
        select: { id: true },
      });
    }

    return bouquet.id;
  }

  private parseM3uLines(lines: string[]): M3uEntry[] {
    const entries: M3uEntry[] = [];
    let meta: Partial<M3uEntry> = {};

    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith('#EXTINF')) {
        meta = {};
        const nameMatch = /,(.+)$/.exec(line);
        if (nameMatch) meta.name = nameMatch[1].trim();

        const logoMatch = /tvg-logo="([^"]*)"/.exec(line);
        if (logoMatch) meta.logo = logoMatch[1];

        const groupMatch = /group-title="([^"]*)"/.exec(line);
        if (groupMatch) meta.groupTitle = groupMatch[1];

        const tvgIdMatch = /tvg-id="([^"]*)"/.exec(line);
        if (tvgIdMatch) meta.tvgId = tvgIdMatch[1];
      } else if (line && !line.startsWith('#')) {
        if (meta.name) {
          entries.push({
            name: meta.name ?? '',
            logo: meta.logo ?? '',
            groupTitle: meta.groupTitle ?? '',
            tvgId: meta.tvgId ?? '',
            url: line,
          });
          meta = {};
        }
      }
    }

    return entries;
  }

  private fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode ?? 'unknown'}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30_000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }
}
