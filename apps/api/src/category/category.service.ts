import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(type?: 'LIVE' | 'VOD' | 'SERIES') {
    try {
      return await this.prisma.category.findMany({
        where: { ...(type ? { type } : {}) },
        include: { bouquet: true, _count: { select: { streams: true } } },
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      });
    } catch (err) {
      this.logger.error(`findAll: ${(err as Error).message}`);
      return [];
    }
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
