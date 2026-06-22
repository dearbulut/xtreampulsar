import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async findAllLive(_userId: string) {
    try {
      return await this.prisma.stream.findMany({
        where: { isActive: true, category: { type: 'LIVE' } },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAllLive: ${(err as Error).message}`);
      return [];
    }
  }

  async findAllVod(_userId: string) {
    try {
      return await this.prisma.stream.findMany({
        where: { isActive: true, category: { type: 'VOD' } },
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAllVod: ${(err as Error).message}`);
      return [];
    }
  }

  async findAllSeries(_userId: string) {
    try {
      return await this.prisma.stream.findMany({
        where: { isActive: true, category: { type: 'SERIES' } },
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
      select: { primaryUrl: true, backupUrl: true, status: true },
    });

    if (!stream) throw new NotFoundException(`Stream ${externalId} not found`);
    if (stream.status === 'OFFLINE' && stream.backupUrl) return stream.backupUrl;
    return stream.primaryUrl;
  }

  findEpgMappings(streamId: string) {
    return this.prisma.ePGMapping.findMany({
      where: { streamId },
      include: { epgSource: true },
    });
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  async findAllWithFilters(_userId: string, query: QueryStreamDto) {
    const { page = 1, limit = 20, search, categoryId, serverId, status, type } = query;

    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(status ? { status: status as 'ONLINE' | 'OFFLINE' | 'BUFFERING' | 'ERROR' } : {}),
      ...(type ? { category: { type: type as 'LIVE' | 'VOD' | 'SERIES' } } : {}),
    };

    try {
      const [items, total] = await Promise.all([
        this.prisma.stream.findMany({
          where,
          include: { category: true, server: true },
          orderBy: { sortOrder: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.stream.count({ where }),
      ]);

      return {
        items,
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
}
