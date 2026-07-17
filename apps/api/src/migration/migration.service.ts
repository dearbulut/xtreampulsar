import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import * as bcrypt from 'bcryptjs';
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
  streamType: 'LIVE' | 'VOD' | 'SERIES';
}

export interface DumpPreview {
  source: 'XTREAMUI' | 'XUIONE' | 'UNKNOWN';
  streams: { total: number; live: number; vod: number; series: number };
  categories: { total: number; live: number; vod: number; series: number };
  users: { total: number };
  resellers: { total: number };
  packages: { total: number };
  bouquets: { total: number };
  epgMappings: { total: number };
}

export interface DumpImportOptions {
  importStreams: boolean;
  importCategories: boolean;
  importUsers: boolean;
  importResellers: boolean;
  importPackages: boolean;
  importBouquets: boolean;
  importEpgMappings: boolean;
  conflictMode: 'SKIP' | 'OVERWRITE' | 'MERGE';
  defaultPassword?: string;
}

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  private readonly jobMeta = new Map<string, {
    filePath: string;
    source: 'XTREAMUI' | 'XUIONE' | 'UNKNOWN';
    tableColumns: Map<string, string[]>;
    tableCounts: Map<string, number>;
  }>();

  constructor(private readonly prisma: PrismaService) {}

  // Madde 3b — startup reconciliation: sunucu yeniden başladığında yarıda kalan
  // (RUNNING/PENDING) job'lar artık çalışmıyordur; sonsuza dek RUNNING kalmasınlar.
  async onModuleInit(): Promise<void> {
    try {
      const res = await this.prisma.migrationJob.updateMany({
        where: { status: { in: ['RUNNING', 'PENDING'] } },
        data: {
          status: 'FAILED',
          errors: ['Sunucu yeniden başladı, iş kesildi'],
          completedAt: new Date(),
        },
      });
      if (res.count > 0) {
        this.logger.warn(`Startup: ${res.count} yarıda kalmış migration job FAILED işaretlendi`);
      }
    } catch (err) {
      this.logger.error(`Startup reconciliation failed: ${(err as Error).message}`);
    }
  }

  // Madde 3a — iptal token'ı: job CANCELLED işaretlendiyse import loop'ları durur.
  private async isCancelled(jobId: string): Promise<boolean> {
    const job = await this.prisma.migrationJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    return job?.status === 'CANCELLED';
  }

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
    try {
      const lines = fileBuffer.toString('utf-8').split('\n');
      const entries = this.parseM3uLines(lines);
      return { entries: entries.slice(0, 20), total: entries.length };
    } catch (err) {
      this.logger.error(`previewM3u: ${(err as Error).message}`);
      return { entries: [], total: 0 };
    }
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

    // categoryMap key = `${name}::${type}` to support same name across types
    const categoryMap = new Map<string, string>();

    const ensureCategory = async (name: string, type: 'LIVE' | 'VOD' | 'SERIES'): Promise<string> => {
      const key = `${name}::${type}`;
      if (categoryMap.has(key)) return categoryMap.get(key)!;

      let cat = await this.prisma.category.findFirst({
        where: { name, type },
        select: { id: true },
      });

      if (!cat) {
        const bouquetId = dto.defaultBouquetId ?? await this.getOrCreateDefaultBouquet();
        cat = await this.prisma.category.create({
          data: { name, type, bouquetId },
          select: { id: true },
        });
      }

      categoryMap.set(key, cat.id);
      return cat.id;
    };

    let i = 0;
    for (const entry of entries) {
      if (++i % 200 === 0 && (await this.isCancelled(jobId))) break; // madde 3a
      try {
        const categoryId = await ensureCategory(entry.groupTitle || 'Uncategorized', entry.streamType);
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

    const cancelled = await this.isCancelled(jobId); // madde 3a: iptal durumunu koru
    await this.prisma.migrationJob.update({
      where: { id: jobId },
      data: {
        status: cancelled ? 'CANCELLED' : failed === entries.length && entries.length > 0 ? 'FAILED' : 'COMPLETED',
        processedRecords: processed,
        failedRecords: failed,
        errors: errors.length > 0 ? errors : Prisma.JsonNull,
        completedAt: new Date(),
      },
    });

    this.logger.log(`M3U import ${jobId}: ${processed} ok, ${failed} failed${cancelled ? ' (iptal edildi)' : ''}`);
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

    let totalImported = 0;
    // Madde 1: her bölüm sonrası ilerlemeyi kaydet → yarım kalan/başarısız import'ta
    // kaç kayıt yazıldığı GÖRÜNÜR olsun (sessiz yarım-import yok).
    const saveProgress = () =>
      this.prisma.migrationJob.update({
        where: { id: jobId },
        data: { totalRecords: totalImported, processedRecords: totalImported },
      });

    try {
      const base = `${dto.serverUrl}/player_api.php?username=${encodeURIComponent(dto.username)}&password=${encodeURIComponent(dto.password)}`;

      if (dto.importLive && !(await this.isCancelled(jobId))) {
        const [cats, streams] = await Promise.all([
          this.fetchJson<{ category_id: string; category_name: string }[]>(`${base}&action=get_live_categories`),
          this.fetchJson<{ name: string; stream_id: number; category_id: string; stream_icon: string; epg_channel_id: string }[]>(`${base}&action=get_live_streams`),
        ]);

        const catIdMap = await this.importXtreamCategories(cats, 'LIVE');
        totalImported += await this.importXtreamStreams(streams, catIdMap, dto.serverUrl, dto.username, dto.password, 'LIVE', jobId);
        await saveProgress();
      }

      if (dto.importVod && !(await this.isCancelled(jobId))) {
        const [cats, streams] = await Promise.all([
          this.fetchJson<{ category_id: string; category_name: string }[]>(`${base}&action=get_vod_categories`),
          this.fetchJson<{ name: string; stream_id: number; category_id: string; stream_icon: string }[]>(`${base}&action=get_vod_streams`),
        ]);

        const catIdMap = await this.importXtreamCategories(cats, 'VOD');
        totalImported += await this.importXtreamStreams(streams, catIdMap, dto.serverUrl, dto.username, dto.password, 'VOD', jobId);
        await saveProgress();
      }

      if (dto.importSeries && !(await this.isCancelled(jobId))) {
        const [cats, series] = await Promise.all([
          this.fetchJson<{ category_id: string; category_name: string }[]>(`${base}&action=get_series_categories`),
          this.fetchJson<{ series_id: number; name: string; cover: string; category_id: string }[]>(`${base}&action=get_series`),
        ]);

        const catIdMap = await this.importXtreamCategories(cats, 'SERIES');
        totalImported += await this.importXtreamSeriesItems(series, catIdMap, dto.serverUrl, dto.username, dto.password, jobId);
        await saveProgress();
      }

      // Madde 3a: iptal edildiyse CANCELLED durumunu KORU (COMPLETED yapma).
      if (await this.isCancelled(jobId)) {
        await this.prisma.migrationJob.update({
          where: { id: jobId },
          data: { totalRecords: totalImported, processedRecords: totalImported, completedAt: new Date() },
        });
        this.logger.warn(`Xtream import ${jobId} iptal edildi — ${totalImported} kayıt işlendi`);
      } else {
        await this.prisma.migrationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            totalRecords: totalImported,
            processedRecords: totalImported,
            completedAt: new Date(),
          },
        });
      }
    } catch (err) {
      this.logger.error(`Xtream import ${jobId} failed: ${(err as Error).message}`);
      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          // Madde 1: hata anına kadar kaç kayıt yazıldığını bildir.
          totalRecords: totalImported,
          processedRecords: totalImported,
          errors: [`${(err as Error).message} (${totalImported} kayıt import edildi)`],
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
    serverUrl: string,
    username: string,
    password: string,
    type: 'LIVE' | 'VOD' | 'SERIES',
    jobId: string,
  ): Promise<number> {
    let count = 0;
    let i = 0;
    const baseUrl = serverUrl.replace(/\/$/, '');

    for (const s of streams) {
      // Madde 3a: periyodik iptal kontrolü.
      if (++i % 500 === 0 && (await this.isCancelled(jobId))) break;

      const categoryId = catIdMap.get(s.category_id);
      if (!categoryId) continue;

      const primaryUrl =
        type === 'VOD'
          ? `${baseUrl}/movie/${username}/${password}/${s.stream_id}.mp4`
          : type === 'SERIES'
          ? `${baseUrl}/series/${username}/${password}/${s.stream_id}.mkv`
          : `${baseUrl}/live/${username}/${password}/${s.stream_id}.m3u8`;

      try {
        // Madde 2/4: externalId (upstream stream_id) global @unique olduğundan farklı
        // panellerin aynı stream_id'si çakışıp öncekini SESSİZCE eziyordu. Dedup'ı
        // primaryUrl (panel+stream'e özgü) ile yap; externalId'yi EXPLICIT verme →
        // autoincrement (çakışma yok, farklı paneller bir arada durur). Series ile
        // aynı desen. Aynı kaynağın tekrar import'u → primaryUrl eşleşir → update
        // (duplicate yok, idempotent).
        const existing = await this.prisma.stream.findFirst({
          where: { primaryUrl },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.stream.update({
            where: { id: existing.id },
            data: {
              name: s.name,
              primaryUrl,
              streamMode: 'PROXY',
              tvgLogo: s.stream_icon || null,
              tvgId: s.epg_channel_id || null,
              categoryId,
            },
          });
        } else {
          await this.prisma.stream.create({
            data: {
              name: s.name,
              primaryUrl,
              streamMode: 'PROXY',
              tvgLogo: s.stream_icon || null,
              tvgId: s.epg_channel_id || null,
              categoryId,
            },
          });
        }
        count++;
      } catch {
        // skip on error
      }
    }

    return count;
  }

  // Series have series_id (not stream_id) and a different response shape.
  // We create one stream record per series (no episode drilling) to keep import fast.
  // primaryUrl is used as the dedup key to avoid externalId collisions with LIVE/VOD.
  private async importXtreamSeriesItems(
    series: { series_id: number; name: string; cover: string; category_id: string }[],
    catIdMap: Map<string, string>,
    serverUrl: string,
    username: string,
    password: string,
    jobId: string,
  ): Promise<number> {
    let count = 0;
    let i = 0;
    const baseUrl = serverUrl.replace(/\/$/, '');
    const playerApi = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    for (const s of series) {
      if (await this.isCancelled(jobId)) break; // her dizi bir API çağrısı → her turda iptal kontrolü
      i++;
      const categoryId = catIdMap.get(s.category_id);
      if (!categoryId) continue;

      const primaryUrl = `${baseUrl}/series/${username}/${password}/${s.series_id}.mkv`;
      let seriesStreamId: string;
      try {
        const existing = await this.prisma.stream.findFirst({ where: { primaryUrl }, select: { id: true } });
        if (existing) {
          await this.prisma.stream.update({ where: { id: existing.id }, data: { name: s.name, tvgLogo: s.cover || null, streamMode: 'PROXY', categoryId } });
          seriesStreamId = existing.id;
        } else {
          const created = await this.prisma.stream.create({ data: { name: s.name, primaryUrl, streamMode: 'PROXY', tvgLogo: s.cover || null, categoryId }, select: { id: true } });
          seriesStreamId = created.id;
        }
        count++;
      } catch {
        continue;
      }

      // Bölümleri çek (best-effort; başarısızsa dizi yine container olarak kalır)
      try {
        const info = await this.fetchJson<{ episodes?: Record<string, Array<{ id: number | string; episode_num?: number; title?: string; container_extension?: string; info?: { plot?: string; movie_image?: string; releasedate?: string; duration_secs?: number } }>> }>(`${playerApi}&action=get_series_info&series_id=${s.series_id}`);
        if (info?.episodes) {
          for (const [seasonKey, eps] of Object.entries(info.episodes)) {
            const season = parseInt(seasonKey, 10) || 0;
            for (const ep of (eps ?? [])) {
              const epNum = ep.episode_num ?? 0;
              const ext = ep.container_extension || 'mkv';
              const epUrl = `${baseUrl}/series/${username}/${password}/${ep.id}.${ext}`;
              await this.prisma.episode.upsert({
                where: { seriesId_season_episode: { seriesId: seriesStreamId, season, episode: epNum } },
                create: { seriesId: seriesStreamId, season, episode: epNum, title: ep.title ?? null, primaryUrl: epUrl, containerExtension: ext, plot: ep.info?.plot ?? null, cover: ep.info?.movie_image ?? null, releaseDate: ep.info?.releasedate ?? null, durationSecs: ep.info?.duration_secs ?? null },
                update: { title: ep.title ?? null, primaryUrl: epUrl, containerExtension: ext },
              }).catch(() => {});
            }
          }
        }
      } catch { /* episode fetch başarısız — geç */ }
    }

    return count;
  }

  // ─── Fix stream types ─────────────────────────────────────────────────────

  async fixStreamTypes(dryRun: boolean): Promise<{
    checked: number;
    changed: number;
    details: Array<{ id: string; name: string; oldType: string; newType: string }>;
  }> {
    const streams = await this.prisma.stream.findMany({
      select: {
        id: true,
        name: true,
        primaryUrl: true,
        categoryId: true,
        category: { select: { id: true, name: true, type: true, bouquetId: true } },
      },
    });

    const toFix: Array<{ id: string; name: string; oldType: string; newType: string; categoryName: string; bouquetId: string }> = [];

    for (const stream of streams) {
      if (!stream.category) continue;
      const inferredType = this.inferStreamType(stream.category.name, stream.primaryUrl, stream.name);
      if (inferredType !== stream.category.type) {
        toFix.push({
          id: stream.id,
          name: stream.name,
          oldType: stream.category.type,
          newType: inferredType,
          categoryName: stream.category.name,
          bouquetId: stream.category.bouquetId,
        });
      }
    }

    if (!dryRun && toFix.length > 0) {
      const categoryCache = new Map<string, string>(); // `${name}::${type}` → id

      for (const item of toFix) {
        const cacheKey = `${item.categoryName}::${item.newType}`;
        let newCategoryId = categoryCache.get(cacheKey);

        if (!newCategoryId) {
          let cat = await this.prisma.category.findFirst({
            where: { name: item.categoryName, type: item.newType as 'LIVE' | 'VOD' | 'SERIES' },
            select: { id: true },
          });

          if (!cat) {
            const bouquetId = item.bouquetId ?? await this.getOrCreateDefaultBouquet();
            cat = await this.prisma.category.create({
              data: { name: item.categoryName, type: item.newType as 'LIVE' | 'VOD' | 'SERIES', bouquetId },
              select: { id: true },
            });
          }

          newCategoryId = cat.id;
          categoryCache.set(cacheKey, newCategoryId);
        }

        await this.prisma.stream.update({
          where: { id: item.id },
          data: { categoryId: newCategoryId },
        });
      }

      this.logger.log(`fixStreamTypes: moved ${toFix.length} streams to correct type categories`);
    }

    return {
      checked: streams.length,
      changed: toFix.length,
      details: toFix.map(({ id, name, oldType, newType }) => ({ id, name, oldType, newType })),
    };
  }

  // ─── SQL Dump upload / preview / import ──────────────────────────────────

  async uploadDump(buffer: Buffer, originalName: string): Promise<{ jobId: string }> {
    const dir = path.join(os.tmpdir(), 'xp-migrations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(dir, `${Date.now()}-${sanitized}`);
    fs.writeFileSync(filePath, buffer);

    const scanResult = await this.scanDump(filePath);

    const prismaSource = scanResult.source === 'XUIONE'
      ? 'XUIONE'
      : 'XTREAMUI';

    const job = await this.prisma.migrationJob.create({
      data: {
        source: prismaSource,
        status: 'PENDING',
      },
    });

    this.jobMeta.set(job.id, {
      filePath,
      source: scanResult.source,
      tableColumns: scanResult.tableColumns,
      tableCounts: scanResult.tableCounts,
    });

    return { jobId: job.id };
  }

  async previewDump(jobId: string): Promise<DumpPreview> {
    const meta = this.jobMeta.get(jobId);
    if (!meta) throw new NotFoundException(`No dump metadata found for job ${jobId}`);

    const { source, tableCounts } = meta;

    const getCount = (...tableNames: string[]): number => {
      for (const name of tableNames) {
        const count = tableCounts.get(name);
        if (count !== undefined) return count;
      }
      return 0;
    };

    const streamsTotal = getCount('streams');
    const categoriesTotal = source === 'XUIONE'
      ? getCount('categories')
      : getCount('stream_categories');
    const usersTotal = source === 'XUIONE'
      ? getCount('lines')
      : getCount('user_info', 'users');
    const resellersTotal = source === 'XUIONE'
      ? getCount('resellers')
      : getCount('reg_users');
    const packagesTotal = getCount('packages');
    const bouquetsTotal = getCount('bouquets');
    const epgMappingsTotal = source === 'XUIONE'
      ? getCount('epg_mappings')
      : getCount('epg_map');

    return {
      source,
      streams: { total: streamsTotal, live: 0, vod: 0, series: 0 },
      categories: { total: categoriesTotal, live: 0, vod: 0, series: 0 },
      users: { total: usersTotal },
      resellers: { total: resellersTotal },
      packages: { total: packagesTotal },
      bouquets: { total: bouquetsTotal },
      epgMappings: { total: epgMappingsTotal },
    };
  }

  async importFromDump(jobId: string, options: DumpImportOptions): Promise<void> {
    const meta = this.jobMeta.get(jobId);
    if (!meta) throw new NotFoundException(`No dump metadata found for job ${jobId}`);

    await this.prisma.migrationJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    void this.runDumpImport(jobId, meta.filePath, meta.source, options);
  }

  // ─── SQL Dump private helpers ─────────────────────────────────────────────

  private async scanDump(filePath: string): Promise<{
    source: 'XTREAMUI' | 'XUIONE' | 'UNKNOWN';
    tableColumns: Map<string, string[]>;
    tableCounts: Map<string, number>;
  }> {
    const tableColumns = new Map<string, string[]>();
    const tableCounts = new Map<string, number>();

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentTable: string | null = null;
    let inCreateTable = false;
    const currentColumns: string[] = [];

    for await (const line of rl) {
      // CREATE TABLE detection
      const createMatch = /^CREATE TABLE [`"']?(\w+)[`"']?/i.exec(line);
      if (createMatch) {
        currentTable = createMatch[1];
        inCreateTable = true;
        currentColumns.length = 0;
        continue;
      }

      if (inCreateTable) {
        // End of CREATE TABLE
        if (/\)\s*ENGINE=/i.test(line) || /^\s*\)\s*;/.test(line)) {
          if (currentTable) {
            tableColumns.set(currentTable, [...currentColumns]);
          }
          inCreateTable = false;
          currentTable = null;
          currentColumns.length = 0;
          continue;
        }
        // Parse column definition
        const colMatch = /^\s+[`"'](\w+)[`"']\s+(int|varchar|text|tinyint|bigint|float|double|decimal|datetime|timestamp|date|char|blob|enum|set|mediumtext|longtext)/i.exec(line);
        if (colMatch) {
          currentColumns.push(colMatch[1]);
        }
        continue;
      }

      // INSERT INTO detection
      const insertMatch = /^INSERT INTO [`"']?(\w+)[`"']?.*VALUES/i.exec(line);
      if (insertMatch) {
        const tableName = insertMatch[1];
        // Count rows: number of ),( plus 1
        const afterValues = line.indexOf('VALUES');
        const valuesStr = afterValues >= 0 ? line.slice(afterValues + 6) : '';
        let rowCount = 1;
        // Count top-level ),( separators
        let depth = 0;
        let extraRows = 0;
        for (let i = 0; i < valuesStr.length; i++) {
          const ch = valuesStr[i];
          if (ch === "'") {
            i++;
            while (i < valuesStr.length) {
              if (valuesStr[i] === '\\') { i += 2; continue; }
              if (valuesStr[i] === "'") break;
              i++;
            }
          } else if (ch === '(') {
            depth++;
          } else if (ch === ')') {
            depth--;
            if (depth === 0 && i + 1 < valuesStr.length && valuesStr[i + 1] === ',') {
              extraRows++;
            }
          }
        }
        rowCount = extraRows + 1;
        const existing = tableCounts.get(tableName) ?? 0;
        tableCounts.set(tableName, existing + rowCount);
      }
    }

    // Detect source
    const tables = [...tableColumns.keys(), ...tableCounts.keys()];
    let source: 'XTREAMUI' | 'XUIONE' | 'UNKNOWN' = 'UNKNOWN';

    const hasStreamCategories = tables.some(t => t === 'stream_categories');
    const hasRegUsers = tables.some(t => t === 'reg_users');
    const hasUserInfo = tables.some(t => t === 'user_info');
    const hasLines = tables.some(t => t === 'lines');
    const hasCategories = tables.some(t => t === 'categories');

    if (hasStreamCategories || hasRegUsers || hasUserInfo) {
      source = 'XTREAMUI';
    } else if (hasLines || (hasCategories && !hasStreamCategories)) {
      source = 'XUIONE';
    }

    return { source, tableColumns, tableCounts };
  }

  private parseSqlValues(valuesStr: string): (string | null)[][] {
    const rows: (string | null)[][] = [];
    let i = 0;
    const len = valuesStr.length;

    const skipWhitespace = () => {
      while (i < len && (valuesStr[i] === ' ' || valuesStr[i] === '\t' || valuesStr[i] === '\n' || valuesStr[i] === '\r')) i++;
    };

    while (i < len) {
      skipWhitespace();
      if (i >= len || valuesStr[i] !== '(') { i++; continue; }
      i++; // skip (

      const row: (string | null)[] = [];
      while (i < len && valuesStr[i] !== ')') {
        skipWhitespace();
        if (valuesStr[i] === ')') break;
        if (valuesStr[i] === ',') { i++; continue; }

        if (valuesStr.slice(i, i + 4) === 'NULL') {
          row.push(null); i += 4;
        } else if (valuesStr[i] === "'") {
          i++;
          let str = '';
          while (i < len) {
            if (valuesStr[i] === '\\' && i + 1 < len) {
              const esc = valuesStr[i + 1];
              if (esc === "'") str += "'";
              else if (esc === '\\') str += '\\';
              else if (esc === 'n') str += '\n';
              else if (esc === 'r') str += '\r';
              else if (esc === 't') str += '\t';
              else str += esc;
              i += 2;
            } else if (valuesStr[i] === "'") { i++; break; }
            else str += valuesStr[i++];
          }
          row.push(str);
        } else {
          let val = '';
          while (i < len && valuesStr[i] !== ',' && valuesStr[i] !== ')') val += valuesStr[i++];
          row.push(val.trim() === 'NULL' ? null : val.trim());
        }
      }
      if (i < len && valuesStr[i] === ')') i++;
      rows.push(row);
      // skip comma between rows
      skipWhitespace();
      if (i < len && valuesStr[i] === ',') i++;
    }
    return rows;
  }

  private extractInsertData(line: string): { table: string; columns: string[] | null; valuesStr: string } | null {
    const m = /^INSERT INTO [`"']?(\w+)[`"']?\s+(?:\(([^)]+)\)\s+)?VALUES\s+(.+?);?\s*$/i.exec(line);
    if (!m) return null;

    const table = m[1];
    const colsRaw = m[2] ?? null;
    const valuesStr = m[3];

    const columns = colsRaw
      ? colsRaw.split(',').map(c => c.trim().replace(/[`"']/g, ''))
      : null;

    return { table, columns, valuesStr };
  }

  private getCol(row: (string | null)[], columns: string[] | null, name: string, fallback: number): string | null {
    if (columns) {
      const idx = columns.indexOf(name);
      return idx >= 0 ? (row[idx] ?? null) : null;
    }
    return row[fallback] ?? null;
  }

  // XtreamUI/XUI.ONE streams.category_id JSON dizisi olabilir ("["5"]"); catCache
  // anahtarları düz kategori id. Diziyse ilk id alınır (modelimiz tek categoryId FK).
  private firstCategoryId(raw: string | null): string | null {
    if (!raw) return null;
    const t = String(raw).trim();
    if (t.startsWith('[')) {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr) && arr.length) return String(arr[0]);
      } catch { /* düz değere düş */ }
    }
    return t || null;
  }

  private async updateJobProgress(jobId: string, processed: number, failed: number, total: number): Promise<void> {
    try {
      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: { processedRecords: processed, failedRecords: failed, totalRecords: total },
      });
    } catch {
      // non-fatal
    }
  }

  private async runDumpImport(
    jobId: string,
    filePath: string,
    source: string,
    options: DumpImportOptions,
  ): Promise<void> {
    const meta = this.jobMeta.get(jobId);
    const tableColumns = meta?.tableColumns ?? new Map<string, string[]>();
    const tableCounts = meta?.tableCounts ?? new Map<string, number>();

    // Compute total records
    let total = 0;
    const getCount = (...names: string[]) => {
      for (const n of names) {
        const c = tableCounts.get(n);
        if (c !== undefined) return c;
      }
      return 0;
    };

    if (options.importBouquets) total += getCount('bouquets');
    if (options.importCategories) {
      total += source === 'XUIONE' ? getCount('categories') : getCount('stream_categories');
    }
    if (options.importStreams) total += getCount('streams');
    if (options.importUsers) {
      total += source === 'XUIONE' ? getCount('lines') : getCount('user_info', 'users');
    }
    if (options.importResellers) {
      total += source === 'XUIONE' ? getCount('resellers') : getCount('reg_users');
    }
    if (options.importPackages) total += getCount('packages');

    await this.updateJobProgress(jobId, 0, 0, total);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Category ID cache: original dump id string → new Category.id
    const catCache = new Map<string, string>();

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let cancelled = false;

    try {
      for await (const line of rl) {
        if (cancelled) break;
        const insertData = this.extractInsertData(line);
        if (!insertData) continue;

        const { table, columns, valuesStr } = insertData;

        // Resolve columns from tableColumns map if not present in INSERT
        const resolvedColumns = columns ?? tableColumns.get(table) ?? null;

        // Determine whether to handle this table
        const isXtreamUI = source !== 'XUIONE';

        let shouldProcess = false;
        let handler: ((row: (string | null)[], cols: string[] | null) => Promise<void>) | null = null;

        if (isXtreamUI) {
          if (table === 'bouquets' && options.importBouquets) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUIBouquet(row, cols, options);
          } else if (table === 'stream_categories' && options.importCategories) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUICategory(row, cols, catCache, options);
          } else if (table === 'streams' && options.importStreams) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUIStream(row, cols, catCache, options);
          } else if ((table === 'user_info' || table === 'users') && options.importUsers) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUIUser(row, cols, options);
          } else if (table === 'reg_users' && options.importResellers) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUIReseller(row, cols, options);
          } else if (table === 'packages' && options.importPackages) {
            shouldProcess = true;
            handler = (row, cols) => this.importXtreamUIPackage(row, cols, options);
          }
        } else {
          // XUI.ONE
          if (table === 'bouquets' && options.importBouquets) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOneBouquet(row, cols, options);
          } else if (table === 'categories' && options.importCategories) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOneCategory(row, cols, catCache, options);
          } else if (table === 'streams' && options.importStreams) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOneStream(row, cols, catCache, options);
          } else if (table === 'lines' && options.importUsers) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOneLine(row, cols, options);
          } else if (table === 'resellers' && options.importResellers) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOneReseller(row, cols, options);
          } else if (table === 'packages' && options.importPackages) {
            shouldProcess = true;
            handler = (row, cols) => this.importXUIOnePackage(row, cols, options);
          }
        }

        if (!shouldProcess || !handler) continue;

        const rows = this.parseSqlValues(valuesStr);
        for (const row of rows) {
          try {
            await handler(row, resolvedColumns);
            processed++;
          } catch (err) {
            failed++;
            errors.push((err as Error).message);
          }

          if ((processed + failed) % 100 === 0) {
            await this.updateJobProgress(jobId, processed, failed, total);
            if (await this.isCancelled(jobId)) { cancelled = true; break; } // madde 3a
          }
        }
      }

      rl.close();
      fileStream.close();

      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: cancelled ? 'CANCELLED' : 'COMPLETED',
          processedRecords: processed,
          failedRecords: failed,
          totalRecords: total,
          errors: errors.length > 0 ? errors : Prisma.JsonNull,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Dump import ${jobId}: ${processed} ok, ${failed} failed`);
    } catch (err) {
      this.logger.error(`Dump import ${jobId} failed: ${(err as Error).message}`);
      await this.prisma.migrationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          processedRecords: processed,
          failedRecords: failed,
          errors: [...errors, (err as Error).message],
          completedAt: new Date(),
        },
      });
    }
  }

  // ─── XtreamUI row handlers ────────────────────────────────────────────────

  private async importXtreamUIBouquet(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'bouquet_name', 1) ?? this.getCol(row, columns, 'name', 1);
    if (!name) return;

    const sortOrderRaw = this.getCol(row, columns, 'bouquet_order', 2) ?? this.getCol(row, columns, 'sort_order', 2);
    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.bouquet.upsert({
        where: { name } as Parameters<typeof this.prisma.bouquet.upsert>[0]['where'],
        create: { name, sortOrder },
        update: { sortOrder },
      });
    } else {
      const existing = await this.prisma.bouquet.findFirst({ where: { name }, select: { id: true } });
      if (!existing) {
        await this.prisma.bouquet.create({ data: { name, sortOrder } });
      }
    }
  }

  private async importXtreamUICategory(
    row: (string | null)[],
    columns: string[] | null,
    cache: Map<string, string>,
    options: DumpImportOptions,
  ): Promise<void> {
    const originalId = this.getCol(row, columns, 'id', 0);
    const name = this.getCol(row, columns, 'category_name', 1) ?? 'Uncategorized';
    const catTypeRaw = this.getCol(row, columns, 'cat_type', 2) ?? '';
    const sortOrderRaw = this.getCol(row, columns, 'cat_order', 3);

    let type: 'LIVE' | 'VOD' | 'SERIES' = 'LIVE';
    const ct = catTypeRaw.toLowerCase();
    if (ct === 'vod' || ct === '2') type = 'VOD';
    else if (ct === 'series' || ct === '3') type = 'SERIES';
    else if (ct === 'live' || ct === '1') type = 'LIVE';

    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
    const bouquetId = await this.getOrCreateDefaultBouquet();

    let categoryId: string;

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
      if (existing) {
        await this.prisma.category.update({ where: { id: existing.id }, data: { sortOrder } });
        categoryId = existing.id;
      } else {
        const created = await this.prisma.category.create({ data: { name, type, sortOrder, bouquetId }, select: { id: true } });
        categoryId = created.id;
      }
    } else {
      const existing = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
      if (existing) {
        categoryId = existing.id;
      } else {
        const created = await this.prisma.category.create({ data: { name, type, sortOrder, bouquetId }, select: { id: true } });
        categoryId = created.id;
      }
    }

    if (originalId) {
      cache.set(originalId, categoryId);
    }
  }

  private async importXtreamUIStream(
    row: (string | null)[],
    columns: string[] | null,
    catCache: Map<string, string>,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'stream_display_name', 1) ?? 'Unknown';
    const categoryIdRaw = this.getCol(row, columns, 'category_id', 2);
    const sourceRaw = this.getCol(row, columns, 'stream_source', 3) ?? '';
    const tvgLogo = this.getCol(row, columns, 'stream_icon', 4) ?? null;

    // Resolve primary URL
    let primaryUrl = sourceRaw;
    if (sourceRaw.trimStart().startsWith('[')) {
      try {
        const arr = JSON.parse(sourceRaw) as string[];
        primaryUrl = Array.isArray(arr) && arr.length > 0 ? arr[0] : sourceRaw;
      } catch {
        primaryUrl = sourceRaw.split(',')[0].trim();
      }
    } else if (sourceRaw.includes(',')) {
      primaryUrl = sourceRaw.split(',')[0].trim();
    }

    if (!primaryUrl) return;

    const catKey = this.firstCategoryId(categoryIdRaw);
    const categoryId = catKey ? catCache.get(catKey) : undefined;
    if (!categoryId) return;

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.stream.findFirst({ where: { primaryUrl }, select: { id: true } });
      if (existing) {
        await this.prisma.stream.update({ where: { id: existing.id }, data: { name, tvgLogo, categoryId } });
      } else {
        await this.prisma.stream.create({ data: { name, primaryUrl, tvgLogo, categoryId } });
      }
    } else {
      const existing = await this.prisma.stream.findFirst({ where: { primaryUrl }, select: { id: true } });
      if (!existing) {
        await this.prisma.stream.create({ data: { name, primaryUrl, tvgLogo, categoryId } });
      }
    }
  }

  private async importXtreamUIUser(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const username = this.getCol(row, columns, 'username', 1);
    if (!username) return;

    let password = this.getCol(row, columns, 'password', 2) ?? '';
    const maxConnectionsRaw = this.getCol(row, columns, 'max_connections', 3);
    const expDateRaw = this.getCol(row, columns, 'exp_date', 4);
    const isTrial = this.getCol(row, columns, 'is_trial', 5);
    const enabledRaw = this.getCol(row, columns, 'enabled', 6);

    // Hash password if not bcrypt
    if (!password.startsWith('$2')) {
      if (options.defaultPassword) {
        password = await bcrypt.hash(options.defaultPassword, 10);
      } else if (password) {
        password = await bcrypt.hash(password, 10);
      } else {
        password = await bcrypt.hash('changeme', 10);
      }
    }

    const maxConnections = maxConnectionsRaw ? parseInt(maxConnectionsRaw, 10) : 1;
    const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const expiresAt = expDateRaw && expDateRaw !== 'NULL' && expDateRaw !== '0'
      ? new Date(parseInt(expDateRaw, 10) * 1000)
      : defaultExpiry;
    const status = enabledRaw === '0' ? 'DISABLED' : 'ACTIVE';
    const notes = isTrial === '1' ? 'trial' : null;

    const data = {
      password,
      maxConnections,
      expiresAt,
      status: status as 'ACTIVE' | 'DISABLED',
      notes,
    };

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.user.upsert({
        where: { username },
        create: { username, ...data },
        update: data,
      });
    } else {
      const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!existing) {
        await this.prisma.user.create({ data: { username, ...data } });
      }
    }
  }

  private async importXtreamUIReseller(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const username = this.getCol(row, columns, 'username', 1);
    if (!username) return;

    let password = this.getCol(row, columns, 'password', 2) ?? '';
    const creditsRaw = this.getCol(row, columns, 'credits', 3);
    const email = `${username}@imported.local`;
    const credits = creditsRaw ? parseInt(creditsRaw, 10) : 0;

    if (!password.startsWith('$2')) {
      if (options.defaultPassword) {
        password = await bcrypt.hash(options.defaultPassword, 10);
      } else if (password) {
        password = await bcrypt.hash(password, 10);
      } else {
        password = await bcrypt.hash('changeme', 10);
      }
    }

    const data = { password, credits };

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.reseller.upsert({
        where: { username },
        create: { username, email, ...data },
        update: data,
      });
    } else {
      const existing = await this.prisma.reseller.findUnique({ where: { username }, select: { id: true } });
      if (!existing) {
        await this.prisma.reseller.create({ data: { username, email, ...data } });
      }
    }
  }

  private async importXtreamUIPackage(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'package_name', 1);
    if (!name) return;

    const durationDaysRaw = this.getCol(row, columns, 'package_duration', 2);
    const priceRaw = this.getCol(row, columns, 'package_price', 3);
    const maxConnectionsRaw = this.getCol(row, columns, 'allowed_outputs', 4);

    const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : 30;
    const price = priceRaw ? parseFloat(priceRaw) : 0;
    const maxConnections = maxConnectionsRaw ? parseInt(maxConnectionsRaw, 10) : 1;
    const creditCost = 1;

    const data = { durationDays, price, maxConnections, creditCost };

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.package.findFirst({ where: { name }, select: { id: true } });
      if (existing) {
        await this.prisma.package.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.package.create({ data: { name, ...data } });
      }
    } else {
      const existing = await this.prisma.package.findFirst({ where: { name }, select: { id: true } });
      if (!existing) {
        await this.prisma.package.create({ data: { name, ...data } });
      }
    }
  }

  // ─── XUI.ONE row handlers ─────────────────────────────────────────────────

  private async importXUIOneBouquet(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'name', 1) ?? this.getCol(row, columns, 'bouquet_name', 1);
    if (!name) return;

    const sortOrderRaw = this.getCol(row, columns, 'sort_order', 2) ?? this.getCol(row, columns, 'order', 2);
    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.bouquet.upsert({
        where: { name } as Parameters<typeof this.prisma.bouquet.upsert>[0]['where'],
        create: { name, sortOrder },
        update: { sortOrder },
      });
    } else {
      const existing = await this.prisma.bouquet.findFirst({ where: { name }, select: { id: true } });
      if (!existing) {
        await this.prisma.bouquet.create({ data: { name, sortOrder } });
      }
    }
  }

  private async importXUIOneCategory(
    row: (string | null)[],
    columns: string[] | null,
    cache: Map<string, string>,
    options: DumpImportOptions,
  ): Promise<void> {
    const originalId = this.getCol(row, columns, 'id', 0);
    const name = this.getCol(row, columns, 'category_name', 1) ?? this.getCol(row, columns, 'name', 1) ?? 'Uncategorized';
    const catTypeRaw = this.getCol(row, columns, 'category_type', 2) ?? this.getCol(row, columns, 'type', 2) ?? '';
    const sortOrderRaw = this.getCol(row, columns, 'sort_order', 3) ?? this.getCol(row, columns, 'order', 3);

    let type: 'LIVE' | 'VOD' | 'SERIES' = 'LIVE';
    const ct = catTypeRaw.toLowerCase();
    if (ct === 'vod' || ct === '2') type = 'VOD';
    else if (ct === 'series' || ct === '3') type = 'SERIES';
    else if (ct === 'live' || ct === '1') type = 'LIVE';

    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
    const bouquetId = await this.getOrCreateDefaultBouquet();

    let categoryId: string;

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
      if (existing) {
        await this.prisma.category.update({ where: { id: existing.id }, data: { sortOrder } });
        categoryId = existing.id;
      } else {
        const created = await this.prisma.category.create({ data: { name, type, sortOrder, bouquetId }, select: { id: true } });
        categoryId = created.id;
      }
    } else {
      const existing = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
      if (existing) {
        categoryId = existing.id;
      } else {
        const created = await this.prisma.category.create({ data: { name, type, sortOrder, bouquetId }, select: { id: true } });
        categoryId = created.id;
      }
    }

    if (originalId) {
      cache.set(originalId, categoryId);
    }
  }

  private async importXUIOneStream(
    row: (string | null)[],
    columns: string[] | null,
    catCache: Map<string, string>,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'stream_display_name', 1)
      ?? this.getCol(row, columns, 'name', 1)
      ?? 'Unknown';
    const categoryIdRaw = this.getCol(row, columns, 'category_id', 2);
    const sourceRaw = this.getCol(row, columns, 'stream_source', 3)
      ?? this.getCol(row, columns, 'url', 3)
      ?? '';
    const tvgLogo = this.getCol(row, columns, 'stream_icon', 4)
      ?? this.getCol(row, columns, 'logo', 4)
      ?? null;

    let primaryUrl = sourceRaw;
    if (sourceRaw.trimStart().startsWith('[')) {
      try {
        const arr = JSON.parse(sourceRaw) as string[];
        primaryUrl = Array.isArray(arr) && arr.length > 0 ? arr[0] : sourceRaw;
      } catch {
        primaryUrl = sourceRaw.split(',')[0].trim();
      }
    } else if (sourceRaw.includes(',')) {
      primaryUrl = sourceRaw.split(',')[0].trim();
    }

    if (!primaryUrl) return;

    const catKey = this.firstCategoryId(categoryIdRaw);
    const categoryId = catKey ? catCache.get(catKey) : undefined;
    if (!categoryId) return;

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.stream.findFirst({ where: { primaryUrl }, select: { id: true } });
      if (existing) {
        await this.prisma.stream.update({ where: { id: existing.id }, data: { name, tvgLogo, categoryId } });
      } else {
        await this.prisma.stream.create({ data: { name, primaryUrl, tvgLogo, categoryId } });
      }
    } else {
      const existing = await this.prisma.stream.findFirst({ where: { primaryUrl }, select: { id: true } });
      if (!existing) {
        await this.prisma.stream.create({ data: { name, primaryUrl, tvgLogo, categoryId } });
      }
    }
  }

  private async importXUIOneLine(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const username = this.getCol(row, columns, 'username', 1);
    if (!username) return;

    let password = this.getCol(row, columns, 'password', 2) ?? '';
    const maxConnectionsRaw = this.getCol(row, columns, 'max_connections', 3);
    const expDateRaw = this.getCol(row, columns, 'exp_date', 4);
    const enabledRaw = this.getCol(row, columns, 'enabled', 5);

    if (!password.startsWith('$2')) {
      if (options.defaultPassword) {
        password = await bcrypt.hash(options.defaultPassword, 10);
      } else if (password) {
        password = await bcrypt.hash(password, 10);
      } else {
        password = await bcrypt.hash('changeme', 10);
      }
    }

    const maxConnections = maxConnectionsRaw ? parseInt(maxConnectionsRaw, 10) : 1;
    const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const expiresAt = expDateRaw && expDateRaw !== 'NULL' && expDateRaw !== '0'
      ? new Date(parseInt(expDateRaw, 10) * 1000)
      : defaultExpiry;
    const status = enabledRaw === '0' ? 'DISABLED' : 'ACTIVE';

    const data = {
      password,
      maxConnections,
      expiresAt,
      status: status as 'ACTIVE' | 'DISABLED',
    };

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.user.upsert({
        where: { username },
        create: { username, ...data },
        update: data,
      });
    } else {
      const existing = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!existing) {
        await this.prisma.user.create({ data: { username, ...data } });
      }
    }
  }

  private async importXUIOneReseller(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const username = this.getCol(row, columns, 'username', 1);
    if (!username) return;

    let password = this.getCol(row, columns, 'password', 2) ?? '';
    const creditsRaw = this.getCol(row, columns, 'credits', 3);
    const emailRaw = this.getCol(row, columns, 'email', 4);
    const email = emailRaw && emailRaw !== 'NULL' ? emailRaw : `${username}@imported.local`;
    const credits = creditsRaw ? parseInt(creditsRaw, 10) : 0;

    if (!password.startsWith('$2')) {
      if (options.defaultPassword) {
        password = await bcrypt.hash(options.defaultPassword, 10);
      } else if (password) {
        password = await bcrypt.hash(password, 10);
      } else {
        password = await bcrypt.hash('changeme', 10);
      }
    }

    const data = { password, credits };

    if (options.conflictMode === 'OVERWRITE') {
      await this.prisma.reseller.upsert({
        where: { username },
        create: { username, email, ...data },
        update: data,
      });
    } else {
      const existing = await this.prisma.reseller.findUnique({ where: { username }, select: { id: true } });
      if (!existing) {
        await this.prisma.reseller.create({ data: { username, email, ...data } });
      }
    }
  }

  private async importXUIOnePackage(
    row: (string | null)[],
    columns: string[] | null,
    options: DumpImportOptions,
  ): Promise<void> {
    const name = this.getCol(row, columns, 'package_name', 1) ?? this.getCol(row, columns, 'name', 1);
    if (!name) return;

    const durationDaysRaw = this.getCol(row, columns, 'package_duration', 2) ?? this.getCol(row, columns, 'duration_days', 2);
    const priceRaw = this.getCol(row, columns, 'price', 3) ?? this.getCol(row, columns, 'package_price', 3);
    const maxConnectionsRaw = this.getCol(row, columns, 'max_connections', 4) ?? this.getCol(row, columns, 'allowed_outputs', 4);

    const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : 30;
    const price = priceRaw ? parseFloat(priceRaw) : 0;
    const maxConnections = maxConnectionsRaw ? parseInt(maxConnectionsRaw, 10) : 1;
    const creditCost = 1;

    const data = { durationDays, price, maxConnections, creditCost };

    if (options.conflictMode === 'OVERWRITE') {
      const existing = await this.prisma.package.findFirst({ where: { name }, select: { id: true } });
      if (existing) {
        await this.prisma.package.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.package.create({ data: { name, ...data } });
      }
    } else {
      const existing = await this.prisma.package.findFirst({ where: { name }, select: { id: true } });
      if (!existing) {
        await this.prisma.package.create({ data: { name, ...data } });
      }
    }
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

  private inferStreamType(groupTitle: string, url: string, name?: string): 'LIVE' | 'VOD' | 'SERIES' {
    // ── 1. URL is the strongest signal ──────────────────────────────────────
    try {
      const urlLower = url.toLowerCase();
      const urlPath = new URL(url).pathname.toLowerCase();

      if (/\/(movie|vod)\//.test(urlPath)) return 'VOD';
      if (/\/series\//.test(urlPath)) return 'SERIES';
      if (/\.(mp4|mkv|avi)(\?|$)/.test(urlLower)) return 'VOD';
      if (/\.m3u8(\?|$)/.test(urlLower)) return 'LIVE';
      if (/\/live\//.test(urlPath)) return 'LIVE';
    } catch {
      // malformed URL — fall through
    }

    // ── 2. Stream name: season-episode pattern → SERIES ───────────────────
    if (name && /S\d+\s*E\d+/i.test(name)) return 'SERIES';

    // ── 3. Group-title analysis (with 24/7 live-channel guard) ────────────
    const gt = groupTitle.toUpperCase();
    const is247 = gt.includes('24/7') || gt.includes('24H');
    const isChannel = gt.includes('KANAL') || gt.includes('CHANNEL');

    // Explicit live signals override everything else
    if (is247 || isChannel) return 'LIVE';

    // Exact match on common standalone genre labels
    const gtTrimmed = gt.trim();
    if (gtTrimmed === 'VOD' || gtTrimmed === 'MOVIES' || gtTrimmed === 'FILMS') return 'VOD';

    // Substring matches — only when live guards are absent
    if (/\b(SERIE|SERIES|DİZİ)\b/.test(gt)) return 'SERIES';
    if (/\b(MOVIE|FILM|FİLM|MOVIES|FILMS)\b/.test(gt)) return 'VOD';

    return 'LIVE';
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
          const groupTitle = meta.groupTitle ?? '';
          entries.push({
            name: meta.name,
            logo: meta.logo ?? '',
            groupTitle,
            tvgId: meta.tvgId ?? '',
            url: line,
            streamType: this.inferStreamType(groupTitle, line, meta.name),
          });
          meta = {};
        }
      }
    }

    return entries;
  }

  // Madde 5: uzak Xtream yanıtı için üst sınır — cap'siz buffer büyük panellerde
  // OOM riski. Aşılırsa indirme iptal + reddedilir (job FAILED olur).
  private static readonly MAX_JSON_BYTES = 100 * 1024 * 1024; // 100MB

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
        let size = 0;
        let aborted = false;
        res.on('data', (c: Buffer) => {
          if (aborted) return;
          size += c.length;
          if (size > MigrationService.MAX_JSON_BYTES) {
            aborted = true;
            req.destroy();
            res.destroy();
            reject(new Error(`Xtream yanıtı çok büyük (>${Math.round(MigrationService.MAX_JSON_BYTES / 1024 / 1024)}MB)`));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => {
          if (aborted) return;
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

  private fetchBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, (res) => {
        if ((res.statusCode ?? 0) >= 400) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MigrationService.MAX_JSON_BYTES) { req.destroy(); reject(new Error('M3U too large')); return; }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  async previewM3uFromUrl(url: string) {
    const buf = await this.fetchBuffer(url);
    return this.previewM3u(buf);
  }

  async importM3uFromUrl(url: string, dto: ImportM3uDto) {
    const buf = await this.fetchBuffer(url);
    return this.importM3u(buf, dto);
  }
}
