import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { SyncProviderDto } from './dto/sync-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

interface VerifyResult {
  ok: boolean;
  status?: string;
  expiresAt?: Date | null;
  maxConnections?: number | null;
  error?: string;
}

type UpType = 'LIVE' | 'VOD' | 'SERIES';

interface BrowseCategory {
  category_id: string;
  category_name: string;
  count: number;
}

interface BrowseTypeResult {
  categories: BrowseCategory[];
  total: number;
  error?: string;
}

interface UpstreamCat {
  category_id: string | number;
  category_name: string;
}
interface UpstreamStream {
  name?: string;
  stream_id?: number | string;
  series_id?: number | string;
  category_id?: string | number;
  stream_icon?: string;
  cover?: string;
  epg_channel_id?: string;
  container_extension?: string;
}

const MAX_JSON_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_SYNC_STREAMS = 60000;

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly syncing = new Set<string>();
  constructor(private readonly prisma: PrismaService) {}

  /** Xtream URL'inden host (scheme+host+port) + username + password ayıklar. */
  parseXtreamUrl(raw: string): { host: string; username?: string; password?: string } {
    const u = new URL(raw.trim());
    return {
      host: `${u.protocol}//${u.host}`,
      username: u.searchParams.get('username') ?? undefined,
      password: u.searchParams.get('password') ?? undefined,
    };
  }

  /** Upstream player_api.php'yi çağırıp auth/durum/expiry/max_connections doğrular. */
  async verifyUpstream(host: string, username?: string, password?: string, userAgent?: string): Promise<VerifyResult> {
    if (!username || !password) return { ok: false, error: 'username/password gerekli' };
    const url = `${host.replace(/\/$/, '')}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, {
        headers: userAgent ? { 'User-Agent': userAgent } : {},
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = (await res.json()) as {
        user_info?: { auth?: number; status?: string; exp_date?: string | number | null; max_connections?: string | number };
      };
      const info = data?.user_info;
      if (!info || Number(info.auth) !== 1) return { ok: false, error: 'Kimlik doğrulama başarısız (auth != 1)' };
      return {
        ok: true,
        status: info.status ?? 'Active',
        expiresAt: info.exp_date ? new Date(Number(info.exp_date) * 1000) : null,
        maxConnections: info.max_connections != null ? Number(info.max_connections) : null,
      };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async create(dto: CreateProviderDto) {
    let { host, username, password } = dto;
    if (dto.url) {
      const parsed = this.parseXtreamUrl(dto.url);
      host = parsed.host;
      username = username ?? parsed.username;
      password = password ?? parsed.password;
    }
    if (!host) throw new BadRequestException('host veya url gerekli');

    const verify = await this.verifyUpstream(host, username, password, dto.userAgent);
    const name = dto.name?.trim() || new URL(host).host;

    return this.prisma.streamProvider.create({
      data: {
        name,
        type: dto.type ?? 'XTREAM',
        host,
        username: username ?? null,
        password: password ?? null,
        userAgent: dto.userAgent ?? null,
        status: verify.ok ? 'ONLINE' : 'OFFLINE',
        lastCheckedAt: new Date(),
        lastError: verify.ok ? null : (verify.error ?? 'unknown'),
        maxConnections: verify.maxConnections ?? null,
        expiresAt: verify.expiresAt ?? null,
      },
    });
  }

  list() {
    return this.prisma.streamProvider.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.streamProvider.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Sağlayıcı bulunamadı');
    });
  }

  async reverify(id: string) {
    const p = await this.prisma.streamProvider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sağlayıcı bulunamadı');
    const v = await this.verifyUpstream(p.host, p.username ?? undefined, p.password ?? undefined, p.userAgent ?? undefined);
    return this.prisma.streamProvider.update({
      where: { id },
      data: {
        status: v.ok ? 'ONLINE' : 'OFFLINE',
        lastCheckedAt: new Date(),
        lastError: v.ok ? null : (v.error ?? 'unknown'),
        maxConnections: v.maxConnections ?? p.maxConnections,
        expiresAt: v.expiresAt ?? p.expiresAt,
      },
    });
  }

  /** URL yapıştırıldığında önizleme: host/user/pass parse + doğrulama (kaydetmeden). */
  async preview(url: string) {
    const parsed = this.parseXtreamUrl(url);
    const v = await this.verifyUpstream(parsed.host, parsed.username, parsed.password);
    return { ...parsed, ...v };
  }

  // ─── Increment 2: Mirror (browse + sync) ───────────────────────────────────

  /** Upstream'in kategori listesini + kategori başına yayın sayısını döner (seçim için). */
  async browse(id: string): Promise<{ live: BrowseTypeResult; vod: BrowseTypeResult; series: BrowseTypeResult }> {
    const p = await this.prisma.streamProvider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sağlayıcı bulunamadı');
    if (!p.username || !p.password) throw new BadRequestException('Sağlayıcıda username/password yok');

    const base = `${p.host.replace(/\/$/, '')}/player_api.php?username=${encodeURIComponent(p.username)}&password=${encodeURIComponent(p.password)}`;
    const ua = p.userAgent ?? undefined;

    const [live, vod, series] = await Promise.all([
      this.browseType(base, ua, 'get_live_categories', 'get_live_streams'),
      this.browseType(base, ua, 'get_vod_categories', 'get_vod_streams'),
      this.browseType(base, ua, 'get_series_categories', 'get_series'),
    ]);
    return { live, vod, series };
  }

  private async browseType(base: string, ua: string | undefined, catAction: string, streamAction: string): Promise<BrowseTypeResult> {
    try {
      const [cats, streams] = await Promise.all([
        this.fetchJson<UpstreamCat[]>(`${base}&action=${catAction}`, ua),
        this.fetchJson<UpstreamStream[]>(`${base}&action=${streamAction}`, ua),
      ]);
      const counts = new Map<string, number>();
      for (const s of streams ?? []) {
        const cid = String(s.category_id ?? '');
        counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      const categories: BrowseCategory[] = (cats ?? [])
        .map((c) => ({ category_id: String(c.category_id), category_name: c.category_name, count: counts.get(String(c.category_id)) ?? 0 }))
        .sort((a, b) => b.count - a.count || a.category_name.localeCompare(b.category_name));
      return { categories, total: (streams ?? []).length };
    } catch (e) {
      return { categories: [], total: 0, error: (e as Error).message };
    }
  }

  /** Upstream kanallarını/kategorilerini kendi kataloğuna aynalar (upsert + drop policy). */
  /** Genel giriş: eşzamanlılık koruması + hata durum kaydı ile mirror çalıştırır. */
  async sync(id: string, dto: SyncProviderDto) {
    if (this.syncing.has(id)) throw new ConflictException('Bu sağlayıcı için senkron zaten çalışıyor');
    this.syncing.add(id);
    try {
      return await this.runSync(id, dto);
    } catch (e) {
      await this.prisma.streamProvider
        .update({
          where: { id },
          data: { lastSyncStatus: 'ERROR', lastSyncMessage: String((e as Error).message).slice(0, 300) } as Parameters<typeof this.prisma.streamProvider.update>[0]['data'],
        })
        .catch(() => undefined);
      throw e;
    } finally {
      this.syncing.delete(id);
    }
  }

  private async runSync(id: string, dto: SyncProviderDto) {
    const p = await this.prisma.streamProvider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sağlayıcı bulunamadı');
    if (!p.username || !p.password) throw new BadRequestException('Sağlayıcıda username/password yok');

    const pc = p as unknown as {
      outputExt?: string; dropPolicy?: string; importLive?: boolean; importVod?: boolean; importSeries?: boolean;
      mirrorBouquetId?: string | null; mirrorServerId?: string | null;
      skipKeywords?: string[]; autoSync?: boolean; syncIntervalMinutes?: number;
    };

    const outputExt = (dto.outputExt ?? pc.outputExt ?? 'ts') === 'm3u8' ? 'm3u8' : 'ts';
    const dropPolicy = (['KEEP', 'DISABLE', 'DELETE'].includes(dto.dropPolicy ?? '') ? dto.dropPolicy : (pc.dropPolicy ?? 'KEEP')) as 'KEEP' | 'DISABLE' | 'DELETE';
    const importLive = dto.importLive ?? pc.importLive ?? true;
    const importVod = dto.importVod ?? pc.importVod ?? false;
    const importSeries = dto.importSeries ?? pc.importSeries ?? false;
    const skipKeywords = (dto.skipKeywords ?? pc.skipKeywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
    const autoSync = dto.autoSync ?? pc.autoSync ?? false;
    const syncIntervalMinutes = Math.max(15, dto.syncIntervalMinutes ?? pc.syncIntervalMinutes ?? 720);
    const matchesSkip = (name: string, cat: string): boolean => {
      if (!skipKeywords.length) return false;
      const hay = `${name} ${cat}`.toLowerCase();
      return skipKeywords.some((k) => hay.includes(k));
    };

    // Hedef bouquet & server çözümle (varsa doğrula).
    let bouquetId = dto.bouquetId ?? pc.mirrorBouquetId ?? null;
    if (bouquetId) {
      const b = await this.prisma.bouquet.findUnique({ where: { id: bouquetId }, select: { id: true } });
      if (!b) throw new BadRequestException('Seçilen bouquet bulunamadı');
    } else {
      bouquetId = await this.getOrCreateDefaultBouquet();
    }
    const serverId = dto.serverId ?? pc.mirrorServerId ?? null;
    if (serverId) {
      const sv = await this.prisma.server.findUnique({ where: { id: serverId }, select: { id: true } });
      if (!sv) throw new BadRequestException('Seçilen sunucu bulunamadı');
    }

    const host = p.host.replace(/\/$/, '');
    const base = `${host}/player_api.php?username=${encodeURIComponent(p.username)}&password=${encodeURIComponent(p.password)}`;
    const ua = p.userAgent ?? undefined;
    const creds = { host, u: p.username, pw: p.password, ext: outputExt };

    // Bu sağlayıcıdan daha önce aynalanan yayınları önyükle (reconciliation için).
    const existing = (await this.prisma.stream.findMany({
      where: { providerId: id } as Parameters<typeof this.prisma.stream.findMany>[0]['where'],
      select: { id: true, providerRef: true } as Parameters<typeof this.prisma.stream.findMany>[0]['select'],
    })) as unknown as Array<{ id: string; providerRef: string | null }>;
    const existingByRef = new Map<string, string>();
    for (const e of existing) if (e.providerRef) existingByRef.set(e.providerRef, e.id);

    const seen = new Set<string>();
    const catCache = new Map<string, string>();
    let added = 0;
    let updated = 0;
    let processed = 0;

    const ensureCategory = async (name: string, type: UpType): Promise<string> => {
      const key = `${type}:${name}`;
      const cached = catCache.get(key);
      if (cached) return cached;
      const found = await this.prisma.category.findFirst({ where: { name, type }, select: { id: true } });
      const cid = found
        ? found.id
        : (await this.prisma.category.create({ data: { name, type, bouquetId: bouquetId as string }, select: { id: true } })).id;
      catCache.set(key, cid);
      return cid;
    };

    const buildUrl = (type: UpType, sid: string | number, containerExt?: string): string => {
      if (type === 'VOD') return `${creds.host}/movie/${creds.u}/${creds.pw}/${sid}.${(containerExt || 'mp4').replace(/^\./, '')}`;
      if (type === 'SERIES') return `${creds.host}/series/${creds.u}/${creds.pw}/${sid}.${(containerExt || 'mkv').replace(/^\./, '')}`;
      return `${creds.host}/live/${creds.u}/${creds.pw}/${sid}.${creds.ext}`;
    };

    const processType = async (type: UpType, catAction: string, streamAction: string, selectedCatIds?: string[]) => {
      let cats: UpstreamCat[] = [];
      let streams: UpstreamStream[] = [];
      try {
        [cats, streams] = await Promise.all([
          this.fetchJson<UpstreamCat[]>(`${base}&action=${catAction}`, ua),
          this.fetchJson<UpstreamStream[]>(`${base}&action=${streamAction}`, ua),
        ]);
      } catch (e) {
        this.logger.warn(`sync ${type} fetch failed: ${(e as Error).message}`);
        return;
      }
      const catNames = new Map<string, string>();
      for (const c of cats ?? []) catNames.set(String(c.category_id), c.category_name);
      const filter = new Set((selectedCatIds ?? []).map(String));

      for (const s of streams ?? []) {
        if (processed >= MAX_SYNC_STREAMS) break;
        const cid = String(s.category_id ?? '');
        if (filter.size && !filter.has(cid)) continue;
        const sid = s.stream_id ?? s.series_id;
        if (sid == null) continue;
        const ref = `${type}:${sid}`;
        if (seen.has(ref)) continue;

        const catName = catNames.get(cid) || 'Uncategorized';
        if (matchesSkip(s.name || '', catName)) continue;
        try {
          const localCatId = await ensureCategory(catName, type);
          const primaryUrl = buildUrl(type, sid, s.container_extension);
          const data: Record<string, unknown> = {
            name: s.name || `#${sid}`,
            primaryUrl,
            streamMode: 'PROXY',
            tvgLogo: s.stream_icon || s.cover || null,
            tvgId: s.epg_channel_id || null,
            categoryId: localCatId,
            serverId: serverId ?? undefined,
            providerId: id,
            providerRef: ref,
            isActive: true,
          };

          const existId = existingByRef.get(ref);
          if (existId) {
            await this.prisma.stream.update({
              where: { id: existId },
              data: data as Parameters<typeof this.prisma.stream.update>[0]['data'],
            });
            updated++;
          } else {
            await this.prisma.stream.create({
              data: data as Parameters<typeof this.prisma.stream.create>[0]['data'],
            });
            added++;
          }
          seen.add(ref);
          processed++;
        } catch (e) {
          this.logger.debug(`sync stream ${ref} skipped: ${(e as Error).message}`);
        }
      }
    };

    if (importLive) await processType('LIVE', 'get_live_categories', 'get_live_streams', dto.liveCategoryIds);
    if (importVod) await processType('VOD', 'get_vod_categories', 'get_vod_streams', dto.vodCategoryIds);
    if (importSeries) await processType('SERIES', 'get_series_categories', 'get_series', dto.seriesCategoryIds);

    // Reconciliation: upstream'de artık olmayan (bu sync'te görülmeyen) yayınlar.
    let removed = 0;
    if (dropPolicy !== 'KEEP') {
      for (const [ref, streamId] of existingByRef) {
        if (seen.has(ref)) continue;
        try {
          if (dropPolicy === 'DELETE') {
            await this.prisma.stream.delete({ where: { id: streamId } });
          } else {
            await this.prisma.stream.update({ where: { id: streamId }, data: { isActive: false } });
          }
          removed++;
        } catch {
          // DELETE FK ihlali → devre dışı bırakmaya düş.
          try {
            await this.prisma.stream.update({ where: { id: streamId }, data: { isActive: false } });
            removed++;
          } catch { /* geç */ }
        }
      }
    }

    // Konfig + istatistikleri sağlayıcıya yaz.
    await this.prisma.streamProvider.update({
      where: { id },
      data: {
        mirrorBouquetId: bouquetId,
        mirrorServerId: serverId,
        outputExt,
        dropPolicy,
        importLive,
        importVod,
        importSeries,
        skipKeywords,
        autoSync,
        syncIntervalMinutes,
        lastSyncedAt: new Date(),
        lastSyncAdded: added,
        lastSyncUpdated: updated,
        lastSyncRemoved: removed,
        lastSyncTotal: seen.size,
        lastSyncStatus: 'OK',
        lastSyncMessage: null,
      } as Parameters<typeof this.prisma.streamProvider.update>[0]['data'],
    });

    return {
      added,
      updated,
      removed,
      total: seen.size,
      bouquetId,
      capped: processed >= MAX_SYNC_STREAMS,
    };
  }

  /** Ayar güncelleme (auto-sync toggle, aralık, skip kelimeler, mirror config). */
  async update(id: string, dto: UpdateProviderDto) {
    const p = await this.prisma.streamProvider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Sağlayıcı bulunamadı');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.userAgent !== undefined) data.userAgent = dto.userAgent || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.autoSync !== undefined) data.autoSync = dto.autoSync;
    if (dto.syncIntervalMinutes !== undefined) data.syncIntervalMinutes = Math.max(15, dto.syncIntervalMinutes);
    if (dto.skipKeywords !== undefined) data.skipKeywords = dto.skipKeywords.map((k) => k.trim()).filter(Boolean);
    if (dto.dropPolicy !== undefined) data.dropPolicy = dto.dropPolicy;
    if (dto.outputExt !== undefined) data.outputExt = dto.outputExt;
    if (dto.mirrorBouquetId !== undefined) data.mirrorBouquetId = dto.mirrorBouquetId || null;
    if (dto.mirrorServerId !== undefined) data.mirrorServerId = dto.mirrorServerId || null;
    if (dto.importLive !== undefined) data.importLive = dto.importLive;
    if (dto.importVod !== undefined) data.importVod = dto.importVod;
    if (dto.importSeries !== undefined) data.importSeries = dto.importSeries;
    return this.prisma.streamProvider.update({
      where: { id },
      data: data as Parameters<typeof this.prisma.streamProvider.update>[0]['data'],
    });
  }

  /** Her 5 dk: autoSync açık ve aralığı dolmuş sağlayıcıları kayıtlı ayarlarıyla aynalar. */
  @Cron('*/5 * * * *')
  async scheduledSync(): Promise<void> {
    let due: Array<{ id: string; name: string }> = [];
    try {
      const all = (await this.prisma.streamProvider.findMany({
        where: { autoSync: true } as Parameters<typeof this.prisma.streamProvider.findMany>[0]['where'],
      })) as unknown as Array<{ id: string; name: string; syncIntervalMinutes?: number; lastSyncedAt?: Date | null }>;
      const now = Date.now();
      due = all.filter((pr) => {
        if (this.syncing.has(pr.id)) return false;
        const interval = (pr.syncIntervalMinutes ?? 720) * 60_000;
        return !pr.lastSyncedAt || now - new Date(pr.lastSyncedAt).getTime() >= interval;
      });
    } catch (e) {
      this.logger.warn(`scheduledSync scan failed: ${(e as Error).message}`);
      return;
    }
    for (const pr of due) {
      this.logger.log(`Auto-sync provider: ${pr.name}`);
      try {
        await this.sync(pr.id, {});
      } catch (e) {
        this.logger.warn(`auto-sync ${pr.name} failed: ${(e as Error).message}`);
      }
    }
  }

  private async getOrCreateDefaultBouquet(): Promise<string> {
    const existing = await this.prisma.bouquet.findFirst({ where: { name: 'Default' }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.bouquet.create({ data: { name: 'Default' }, select: { id: true } });
    return created.id;
  }

  private fetchJson<T>(url: string, userAgent?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(url, { headers: userAgent ? { 'User-Agent': userAgent } : {} }, (res) => {
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
          if (size > MAX_JSON_BYTES) {
            aborted = true;
            req.destroy();
            res.destroy();
            reject(new Error(`Upstream yanıtı çok büyük (>${Math.round(MAX_JSON_BYTES / 1024 / 1024)}MB)`));
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
}
