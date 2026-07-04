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
        _count: { select: { categories: true, userBouquets: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    const bouquet = await this.prisma.bouquet.findUnique({
      where: { id },
      include: {
        categories: { include: { _count: { select: { streams: true } } } },
        _count: { select: { userBouquets: true } },
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

  // NOT: Entitlement kategori-bazlı (Category.bouquetId). Bir kategori yalnızca
  // TEK bouquet'e ait olabildiğinden (zorunlu FK) kategoriler klonlanamaz; clone
  // yalnızca bouquet meta verisini (ad/açıklama/durum) kopyalar. Kategori atamaları
  // Kategoriler sayfasından yapılır.
  async clone(bouquetId: string) {
    const source = await this.prisma.bouquet.findUnique({ where: { id: bouquetId } });
    if (!source) throw new NotFoundException(`Bouquet ${bouquetId} not found`);

    return this.prisma.bouquet.create({
      data: {
        name: `${source.name} (Kopya)`,
        description: source.description ?? undefined,
        isActive: source.isActive,
      },
    });
  }

  async resign(bouquetId: string): Promise<{ usersUpdated: number }> {
    await this.findById(bouquetId);
    const count = await this.prisma.userBouquet.count({ where: { bouquetId } });
    return { usersUpdated: count };
  }
}
