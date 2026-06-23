import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBouquetDto } from './dto/create-bouquet.dto';
import { UpdateBouquetDto } from './dto/update-bouquet.dto';

@Injectable()
export class BouquetService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bouquet.findMany({
      include: {
        _count: { select: { categories: true, bouquetStreams: true, userBouquets: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    const bouquet = await this.prisma.bouquet.findUnique({
      where: { id },
      include: {
        categories: { include: { _count: { select: { streams: true } } } },
        _count: { select: { bouquetStreams: true, userBouquets: true } },
      },
    });
    if (!bouquet) throw new NotFoundException(`Bouquet ${id} not found`);
    return bouquet;
  }

  create(dto: CreateBouquetDto) {
    return this.prisma.bouquet.create({ data: dto });
  }

  async update(id: string, dto: UpdateBouquetDto) {
    await this.findById(id);
    return this.prisma.bouquet.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.bouquet.delete({ where: { id } });
  }

  async clone(bouquetId: string) {
    const source = await this.prisma.bouquet.findUnique({
      where: { id: bouquetId },
      include: { bouquetStreams: { select: { streamId: true, sortOrder: true } } },
    });
    if (!source) throw new NotFoundException(`Bouquet ${bouquetId} not found`);

    const cloned = await this.prisma.bouquet.create({
      data: {
        name: `${source.name} (Kopya)`,
        description: source.description ?? undefined,
        isActive: source.isActive,
      },
    });

    if (source.bouquetStreams.length > 0) {
      await this.prisma.bouquetStream.createMany({
        data: source.bouquetStreams.map((bs) => ({
          bouquetId: cloned.id,
          streamId: bs.streamId,
          sortOrder: bs.sortOrder,
        })),
        skipDuplicates: true,
      });
    }

    return cloned;
  }

  async setStreams(
    bouquetId: string,
    streamIds: string[],
  ): Promise<{ added: number; removed: number }> {
    await this.findById(bouquetId);

    const existing = await this.prisma.bouquetStream.findMany({
      where: { bouquetId },
      select: { streamId: true },
    });

    const existingIds = new Set(existing.map((e) => e.streamId));
    const newIds = new Set(streamIds);

    const toAdd = streamIds.filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !newIds.has(id));

    await this.prisma.$transaction([
      this.prisma.bouquetStream.deleteMany({
        where: { bouquetId, streamId: { in: toRemove } },
      }),
      this.prisma.bouquetStream.createMany({
        data: toAdd.map((streamId) => ({ bouquetId, streamId })),
        skipDuplicates: true,
      }),
    ]);

    return { added: toAdd.length, removed: toRemove.length };
  }

  async getBouquetStreams(bouquetId: string) {
    await this.findById(bouquetId);
    const rows = await this.prisma.bouquetStream.findMany({
      where: { bouquetId },
      include: {
        stream: {
          select: {
            id: true,
            name: true,
            externalId: true,
            status: true,
            tvgLogo: true,
            isActive: true,
            category: { select: { id: true, name: true, type: true } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => r.stream);
  }

  async replaceStreams(
    bouquetId: string,
    streamIds: string[],
  ): Promise<{ count: number }> {
    await this.findById(bouquetId);

    await this.prisma.$transaction([
      this.prisma.bouquetStream.deleteMany({ where: { bouquetId } }),
      this.prisma.bouquetStream.createMany({
        data: streamIds.map((streamId, i) => ({ bouquetId, streamId, sortOrder: i })),
        skipDuplicates: true,
      }),
    ]);

    return { count: streamIds.length };
  }

  async resign(bouquetId: string): Promise<{ usersUpdated: number }> {
    await this.findById(bouquetId);
    const count = await this.prisma.userBouquet.count({ where: { bouquetId } });
    return { usersUpdated: count };
  }
}
