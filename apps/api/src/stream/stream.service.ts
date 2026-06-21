import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamService {
  constructor(private readonly prisma: PrismaService) {}

  findAllLive(userId: string) {
    return this.prisma.stream.findMany({
      where: { isActive: true, category: { type: 'LIVE' } },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  findAllVod(userId: string) {
    return this.prisma.stream.findMany({
      where: { isActive: true, category: { type: 'VOD' } },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  findAllSeries(userId: string) {
    return this.prisma.stream.findMany({
      where: { isActive: true, category: { type: 'SERIES' } },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  findAllActive(userId: string) {
    return this.prisma.stream.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { sortOrder: 'asc' },
    });
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

  async findById(id: string) {
    return this.prisma.stream.findUnique({
      where: { id },
      include: { category: true, epgMappings: true },
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

    if (stream.status === 'OFFLINE' && stream.backupUrl) {
      return stream.backupUrl;
    }

    return stream.primaryUrl;
  }

  findEpgMappings(streamId: string) {
    return this.prisma.ePGMapping.findMany({
      where: { streamId },
      include: { epgSource: true },
    });
  }
}
