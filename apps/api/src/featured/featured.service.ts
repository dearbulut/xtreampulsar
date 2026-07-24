import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EventInput {
  title?: string;
  description?: string | null;
  logoUrl?: string | null;
  startsAt?: string | null;
  streamId?: string | null;
  categoryId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable()
export class FeaturedService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.featuredEvent.findMany({ orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }] });
  }

  /** Public: yalnizca aktif etkinlikler (baslangici gecmemis veya zamansiz). */
  listPublic() {
    return this.prisma.featuredEvent.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { startsAt: 'asc' }],
      select: { id: true, title: true, description: true, logoUrl: true, startsAt: true, streamId: true, categoryId: true },
    });
  }

  private toData(dto: EventInput) {
    const d: Record<string, unknown> = {};
    if (dto.title !== undefined) d.title = dto.title;
    if (dto.description !== undefined) d.description = dto.description;
    if (dto.logoUrl !== undefined) d.logoUrl = dto.logoUrl;
    if (dto.startsAt !== undefined) d.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.streamId !== undefined) d.streamId = dto.streamId || null;
    if (dto.categoryId !== undefined) d.categoryId = dto.categoryId || null;
    if (dto.isActive !== undefined) d.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) d.sortOrder = dto.sortOrder;
    return d;
  }

  create(dto: EventInput) {
    return this.prisma.featuredEvent.create({ data: { title: dto.title ?? 'Etkinlik', ...this.toData(dto) } });
  }

  async update(id: string, dto: EventInput) {
    await this.getOne(id);
    return this.prisma.featuredEvent.update({ where: { id }, data: this.toData(dto) });
  }

  async getOne(id: string) {
    const e = await this.prisma.featuredEvent.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Etkinlik bulunamadı');
    return e;
  }

  async remove(id: string) {
    await this.getOne(id);
    await this.prisma.featuredEvent.delete({ where: { id } });
    return { success: true };
  }
}
