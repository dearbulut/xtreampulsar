import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

// ─── Toplu URL / DNS degistirme (roadmap J) ──────────────────────────────────

/** Uzerinde arama-degistirme yapilabilen akis URL alanlari. */
export const URL_FIELDS = [
  'primaryUrl',
  'backupUrl',
  'backupUrls',
  'loopSources',
] as const;
export type UrlField = (typeof URL_FIELDS)[number];

export interface ReplaceUrlOptions {
  search: string;
  replace: string;
  streamType?: 'LIVE' | 'VOD' | 'SERIES' | 'ALL';
  categoryId?: string;
  serverId?: string;
  fields?: UrlField[];
  /** Varsayilan TRUE — yazma islemi ancak acikca false gonderilirse yapilir. */
  dryRun?: boolean;
  /** Degisen ve o an calisan yayinlari IDLE'a cekerek yeniden baslat. */
  restartAffected?: boolean;
}

export interface ReplaceUrlSample {
  id: string;
  name: string;
  field: UrlField;
  before: string;
  after: string;
}

export interface ReplaceUrlResult {
  dryRun: boolean;
  scanned: number;
  matched: number;
  updated: number;
  restarted: number;
  runningAffected: number;
  byField: Record<string, number>;
  samples: ReplaceUrlSample[];
}

/** Tek seferde DB'den cekilen akis sayisi. */
const REPLACE_SCAN_BATCH = 500;
/** Es zamanli update sayisi. */
const REPLACE_WRITE_CHUNK = 50;
/** Onizlemede gosterilen ornek sayisi. */
const REPLACE_SAMPLE_LIMIT = 20;

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';

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

  // ─── Toplu URL / DNS degistir (roadmap J) ────────────────────────────────────

  /**
   * Akis URL alanlarinda duz-metin arama/degistirme yapar (regex DEGIL).
   * Varsayilan olarak dryRun=true: hicbir sey yazilmaz, yalnizca kac kaydin
   * etkilenecegi ve ornek onizlemeler doner. Yazmak icin dryRun:false sart.
   */
  async replaceUrl(opts: ReplaceUrlOptions): Promise<ReplaceUrlResult> {
    const search = (opts.search ?? '').trim();
    if (search.length < 3) {
      throw new BadRequestException(
        'Aranan metin en az 3 karakter olmali (kazara toplu degisiklik korumasi)',
      );
    }
    const replace = opts.replace ?? '';
    const requested = opts.fields?.length ? opts.fields : [...URL_FIELDS];
    const fields = requested.filter((f): f is UrlField =>
      (URL_FIELDS as readonly string[]).includes(f),
    );
    if (!fields.length) {
      throw new BadRequestException('En az bir URL alani secilmeli');
    }
    const dryRun = opts.dryRun !== false;

    const where: Record<string, unknown> = {};
    if (opts.categoryId) {
      where.categoryId = opts.categoryId;
    } else if (opts.streamType && opts.streamType !== 'ALL') {
      where.category = { type: opts.streamType };
    }
    if (opts.serverId) where.serverId = opts.serverId;

    const byField: Record<string, number> = {};
    const samples: ReplaceUrlSample[] = [];
    const affectedRunning: string[] = [];
    let scanned = 0;
    let matched = 0;
    let updated = 0;
    let cursor: string | undefined;

    const swap = (v: string): string => v.split(search).join(replace);

    for (;;) {
      const batch = await this.prisma.stream.findMany({
        where: where as never,
        take: REPLACE_SCAN_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          workerStatus: true,
          primaryUrl: true,
          backupUrl: true,
          backupUrls: true,
          loopSources: true,
        },
      });
      if (!batch.length) break;
      cursor = batch[batch.length - 1].id;
      scanned += batch.length;

      const pending: Array<{ id: string; data: Record<string, unknown> }> = [];

      for (const row of batch) {
        const s = row as unknown as Record<string, unknown> & {
          id: string;
          name: string;
          workerStatus: string | null;
        };
        const data: Record<string, unknown> = {};
        let hit = false;

        for (const f of fields) {
          const raw = s[f];

          if (Array.isArray(raw)) {
            const arr = raw as string[];
            const hits = arr.filter((v) => typeof v === 'string' && v.includes(search));
            if (!hits.length) continue;
            data[f] = arr.map((v) => (typeof v === 'string' ? swap(v) : v));
            hit = true;
            byField[f] = (byField[f] ?? 0) + hits.length;
            if (samples.length < REPLACE_SAMPLE_LIMIT) {
              samples.push({
                id: s.id, name: s.name, field: f,
                before: hits[0], after: swap(hits[0]),
              });
            }
            continue;
          }

          if (typeof raw !== 'string' || !raw.includes(search)) continue;
          const next = swap(raw);
          // primaryUrl zorunlu alan — bosa dusurup akisi bozmayalim.
          if (f === 'primaryUrl' && !next.trim()) continue;
          data[f] = next;
          hit = true;
          byField[f] = (byField[f] ?? 0) + 1;
          if (samples.length < REPLACE_SAMPLE_LIMIT) {
            samples.push({ id: s.id, name: s.name, field: f, before: raw, after: next });
          }
        }

        if (!hit) continue;
        matched++;
        if (s.workerStatus === 'RUNNING') affectedRunning.push(s.id);
        pending.push({ id: s.id, data });
      }

      if (!dryRun && pending.length) {
        for (let i = 0; i < pending.length; i += REPLACE_WRITE_CHUNK) {
          const chunk = pending.slice(i, i + REPLACE_WRITE_CHUNK);
          const results = await Promise.allSettled(
            chunk.map((u) =>
              this.prisma.stream.update({
                where: { id: u.id },
                data: u.data as never,
              }),
            ),
          );
          updated += results.filter((r) => r.status === 'fulfilled').length;
          for (const r of results) {
            if (r.status === 'rejected') {
              this.logger.warn(`replaceUrl update hatasi: ${String(r.reason)}`);
            }
          }
        }
      }

      if (batch.length < REPLACE_SCAN_BATCH) break;
    }

    let restarted = 0;
    if (!dryRun && opts.restartAffected && affectedRunning.length) {
      // restartAllStreams ile ayni mantik: RUNNING -> IDLE, worker otomatik toplar.
      const r = await this.prisma.stream.updateMany({
        where: { id: { in: affectedRunning }, workerStatus: 'RUNNING' },
        data: { workerStatus: 'IDLE' },
      });
      restarted = r.count;
    }

    this.logger.log(
      `replaceUrl${dryRun ? ' [onizleme]' : ''}: "${search}" -> "${replace}" | ` +
        `tarandi=${scanned} eslesti=${matched} guncellendi=${updated} yeniden_baslatildi=${restarted}`,
    );

    return {
      dryRun, scanned, matched, updated, restarted,
      runningAffected: affectedRunning.length,
      byField, samples,
    };
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

  // ─── VOD Film Süreleri (ffprobe) ─────────────────────────────────────────────

  /** Süresi (durationSecs) boş VOD'ları sınırlı bir grup halinde ffprobe ile doldurur (arka planda). */
  async probeVodDurations(limit = 200): Promise<{ pending: number; started: boolean }> {
    const vods = await this.prisma.stream.findMany({
      where: { category: { type: 'VOD' }, durationSecs: null },
      select: { id: true, primaryUrl: true },
      take: Math.min(Math.max(limit, 1), 1000),
    });
    if (vods.length) void this.runProbeVodDurations(vods);
    return { pending: vods.length, started: vods.length > 0 };
  }

  private async runProbeVodDurations(vods: Array<{ id: string; primaryUrl: string }>): Promise<void> {
    const execFileAsync = promisify(execFile);
    let updated = 0;
    for (const v of vods) {
      try {
        const { stdout } = await execFileAsync(
          this.ffprobePath,
          ['-v', 'quiet', '-print_format', 'json', '-show_format', v.primaryUrl],
          { timeout: 15_000, maxBuffer: 1024 * 1024 },
        );
        const dur = Math.round(Number(JSON.parse(stdout)?.format?.duration) || 0);
        if (dur > 0) {
          await this.prisma.stream.update({ where: { id: v.id }, data: { durationSecs: dur } });
          updated++;
        }
      } catch {
        /* ffprobe başarısız / zaman aşımı → geç */
      }
      if (updated > 0 && updated % 50 === 0) this.logger.log(`probeVodDurations: ${updated} güncellendi`);
    }
    this.logger.log(`probeVodDurations: tamam, ${updated}/${vods.length} güncellendi`);
  }

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

  // Dış bir Xtream panelin hattını kontrol et (player_api.php user_info + server_info).
  async iptvCheck(host: string, username: string, password: string) {
    let base = (host ?? '').trim().replace(/\/+$/, '');
    if (!base) return { ok: false, error: 'Host gerekli' };
    if (!/^https?:\/\//.test(base)) base = 'http://' + base;
    const url = `${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    let resp: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'XtreamPulsar-Checker' } });
      clearTimeout(timer);
    } catch (e) {
      return { ok: false, error: 'Bağlanılamadı: ' + (e as Error).message };
    }
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };

    let data: Record<string, unknown>;
    try { data = (await resp.json()) as Record<string, unknown>; }
    catch { return { ok: false, error: 'Geçersiz yanıt (JSON değil) — Xtream paneli olmayabilir' }; }

    const ui = data?.user_info as Record<string, unknown> | undefined;
    const si = data?.server_info as Record<string, unknown> | undefined;
    if (!ui) return { ok: false, error: 'user_info yok — geçersiz kimlik bilgisi olabilir' };

    const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
    const tsToIso = (v: unknown) => (v ? new Date(Number(v) * 1000).toISOString() : null);

    return {
      ok: true,
      auth: ui.auth === 1 || ui.auth === '1',
      status: String(ui.status ?? ''),
      isTrial: ui.is_trial === '1' || ui.is_trial === 1,
      expDate: tsToIso(ui.exp_date),
      createdAt: tsToIso(ui.created_at),
      activeCons: num(ui.active_cons),
      maxConnections: num(ui.max_connections),
      serverUrl: (si?.url as string) ?? null,
      serverPort: (si?.port as string) ?? null,
      httpsPort: (si?.https_port as string) ?? null,
      timezone: (si?.timezone as string) ?? null,
    };
  }
}
