import * as http from 'http';
import * as https from 'https';
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { QueryStreamDto } from './dto/query-stream.dto';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Xtream-facing queries (no auth, type-based) ───────────────────────────

  // FAIL-CLOSED: bouquet'i olmayan kullanıcı hiçbir kanal görmemeli. Boş dizi
  // döner; çağıranlar `in: []` ile filtreleyince sonuç boş olur (eskiden null
  // dönüp filtreyi atlıyordu = fail-open, tüm katalog görünüyordu).
  private async getUserBouquetIds(userId: string): Promise<string[]> {
    const userBouquets = await this.prisma.userBouquet.findMany({
      where: { userId },
      select: { bouquetId: true },
    });
    return userBouquets.map((ub) => ub.bouquetId);
  }

  // Bir kullanıcının, istenen stream'e paketi (bouquet) üzerinden erişip
  // erişemeyeceğini döner. Bouquet'i yoksa fail-closed → false.
  async canUserAccessStream(
    userId: string,
    target: { streamId?: string; externalId?: number },
  ): Promise<boolean> {
    const bouquetIds = await this.getUserBouquetIds(userId);
    if (bouquetIds.length === 0) return false;
    const link = await this.prisma.bouquetStream.findFirst({
      where: {
        bouquetId: { in: bouquetIds },
        ...(target.streamId
          ? { streamId: target.streamId }
          : { stream: { externalId: target.externalId } }),
      },
      select: { streamId: true },
    });
    return !!link;
  }

  async findAllLive(userId: string) {
    try {
      const bouquetIds = await this.getUserBouquetIds(userId);
      return await this.prisma.stream.findMany({
        where: {
          isActive: true,
          category: { type: 'LIVE' },
          ...(bouquetIds ? { bouquetStreams: { some: { bouquetId: { in: bouquetIds } } } } : {}),
        },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAllLive: ${(err as Error).message}`);
      return [];
    }
  }

  async findAllVod(userId: string) {
    try {
      const bouquetIds = await this.getUserBouquetIds(userId);
      return await this.prisma.stream.findMany({
        where: {
          isActive: true,
          category: { type: 'VOD' },
          ...(bouquetIds ? { bouquetStreams: { some: { bouquetId: { in: bouquetIds } } } } : {}),
        },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAllVod: ${(err as Error).message}`);
      return [];
    }
  }

  async findAllSeries(userId: string) {
    try {
      const bouquetIds = await this.getUserBouquetIds(userId);
      return await this.prisma.stream.findMany({
        where: {
          isActive: true,
          category: { type: 'SERIES' },
          ...(bouquetIds ? { bouquetStreams: { some: { bouquetId: { in: bouquetIds } } } } : {}),
        },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAllSeries: ${(err as Error).message}`);
      return [];
    }
  }

  findLiveCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true, type: 'LIVE' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findVodCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true, type: 'VOD' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findSeriesCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true, type: 'SERIES' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findByExternalId(externalId: number) {
    return this.prisma.stream.findUnique({
      where: { externalId },
      include: { category: true, epgMappings: true },
    });
  }

  async getStreamUrl(externalId: number): Promise<string> {
    const stream = await this.prisma.stream.findUnique({
      where: { externalId },
      select: { id: true, primaryUrl: true, backupUrl: true, backupUrls: true, status: true },
    });

    if (!stream) throw new NotFoundException(`Stream ${externalId} not found`);

    // Fast path: stream is healthy
    if (stream.status !== 'OFFLINE') return stream.primaryUrl;

    // Build candidate list: new backupUrls array first, then legacy backupUrl
    const candidates: string[] = stream.backupUrls.length > 0
      ? stream.backupUrls
      : (stream.backupUrl ? [stream.backupUrl] : []);

    for (const url of candidates) {
      const ok = await this.probeUrl(url, 3000);
      if (ok) {
        this.logger.warn(`Stream #${externalId}: failover → ${url}`);
        void this.prisma.streamHealthLog.create({
          data: { streamId: stream.id, status: 'failover', errorMessage: `Failover to: ${url}` },
        }).catch(() => {});
        return url;
      }
    }

    throw new ServiceUnavailableException('Tüm kaynak URL\'ler erişilemez');
  }

  async updateBackupUrls(id: string, backupUrls: string[]): Promise<void> {
    await this.findById(id);
    await this.prisma.stream.update({ where: { id }, data: { backupUrls } });
  }

  private probeUrl(url: string, timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        resolve(false);
        return;
      }
      const mod = url.startsWith('https://') ? https : http;
      const timer = setTimeout(() => { req.destroy(); resolve(false); }, timeoutMs);
      const req = mod.request(url, { method: 'HEAD' }, (res) => {
        clearTimeout(timer);
        res.resume();
        const sc = res.statusCode ?? 0;
        resolve(sc >= 200 && sc < 500);
      });
      req.on('error', () => { clearTimeout(timer); resolve(false); });
      req.end();
    });
  }

  findEpgMappings(streamId: string) {
    return this.prisma.ePGMapping.findMany({
      where: { streamId },
      include: { epgSource: true },
    });
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  async findAllWithFilters(_userId: string, query: QueryStreamDto) {
    const { page = 1, limit = 20, search, categoryId, serverId, status, type, resolution, qualityScore, healthStatus, videoCodec, updatedAfter } = query;

    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(status ? { status: status as 'ONLINE' | 'OFFLINE' | 'BUFFERING' | 'ERROR' } : {}),
      ...(type ? { category: { type: type as 'LIVE' | 'VOD' | 'SERIES' } } : {}),
      ...(resolution ? { resolution: { contains: resolution, mode: 'insensitive' as const } } : {}),
      ...(qualityScore ? { qualityScore } : {}),
      ...(healthStatus ? { healthStatus } : {}),
      ...(videoCodec ? { videoCodec: { contains: videoCodec, mode: 'insensitive' as const } } : {}),
      ...(updatedAfter ? { updatedAt: { gte: new Date(updatedAfter) } } : {}),
    };

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [items, total] = await Promise.all([
        this.prisma.stream.findMany({
          where,
          include: {
            category: true,
            server: true,
            _count: { select: { connections: true } },
          },
          orderBy: { sortOrder: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.stream.count({ where }),
      ]);

      const streamIds = items.map((s) => s.id);

      // Fetch today's view counts and lastViewedAt in parallel
      const [todayGroups, lastViewedGroups] = await Promise.all([
        streamIds.length > 0
          ? this.prisma.connection.groupBy({
              by: ['streamId'],
              where: { streamId: { in: streamIds }, startedAt: { gte: startOfToday } },
              _count: { streamId: true },
            })
          : Promise.resolve([]),
        streamIds.length > 0
          ? this.prisma.connection.groupBy({
              by: ['streamId'],
              where: { streamId: { in: streamIds } },
              _max: { startedAt: true },
            })
          : Promise.resolve([]),
      ]);

      const todayMap = new Map(todayGroups.map((g) => [g.streamId, g._count.streamId]));
      const lastMap = new Map(lastViewedGroups.map((g) => [g.streamId, g._max.startedAt]));

      const enriched = items.map((s) => ({
        ...s,
        todayViews: todayMap.get(s.id) ?? 0,
        totalViews: s._count.connections,
        lastViewedAt: lastMap.get(s.id) ?? null,
      }));

      return {
        items: enriched,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err) {
      this.logger.error(`findAllWithFilters: ${(err as Error).message}`);
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  async findById(id: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id },
      include: { category: true, server: true, epgMappings: true },
    });
    if (!stream) throw new NotFoundException(`Stream ${id} not found`);
    return stream;
  }

  create(dto: CreateStreamDto) {
    return this.prisma.stream.create({
      data: dto,
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateStreamDto) {
    await this.findById(id);
    return this.prisma.stream.update({
      where: { id },
      data: dto as Prisma.StreamUncheckedUpdateInput,
      include: { category: true },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.stream.delete({ where: { id } });
  }

  async reorderStreams(streamIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      streamIds.map((id, index) =>
        this.prisma.stream.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }

  async bulkMoveCategory(streamIds: string[], targetCategoryId: string): Promise<number> {
    const result = await this.prisma.stream.updateMany({
      where: { id: { in: streamIds } },
      data: { categoryId: targetCategoryId },
    });
    return result.count;
  }

  async cloneStream(id: string, overrides?: Partial<{ name: string; primaryUrl: string }>) {
    const original = await this.findById(id);

    const maxResult = await this.prisma.stream.aggregate({ _max: { externalId: true } });
    const newExternalId = (maxResult._max.externalId ?? 0) + 1;

    const maxSort = await this.prisma.stream.aggregate({ _max: { sortOrder: true } });
    const newSortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const cloned = await this.prisma.stream.create({
      data: {
        name: overrides?.name ?? `${original.name} (Kopya)`,
        primaryUrl: overrides?.primaryUrl ?? original.primaryUrl,
        backupUrl: original.backupUrl ?? undefined,
        externalId: newExternalId,
        sortOrder: newSortOrder,
        categoryId: original.categoryId,
        serverId: original.serverId ?? undefined,
        tvgId: original.tvgId ?? undefined,
        tvgLogo: original.tvgLogo ?? undefined,
        isActive: false,
      },
      include: { category: true },
    });

    this.logger.log(`Stream cloned: ${original.name} → ${cloned.name} (externalId=${newExternalId})`);
    return cloned;
  }
}
