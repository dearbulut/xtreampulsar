import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(type?: 'LIVE' | 'VOD' | 'SERIES') {
    return this.prisma.category.findMany({
      where: { ...(type ? { type } : {}) },
      include: { bouquet: true, _count: { select: { streams: true } } },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findById(id: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { bouquet: true, _count: { select: { streams: true } } },
    });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);
    return cat;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
  }

  findStreams(id: string, page = 1, limit = 20) {
    return this.prisma.stream.findMany({
      where: { categoryId: id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
