import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.package.findMany({
      orderBy: { creditCost: 'asc' },
      include: {
        _count: { select: { users: true } },
        bouquets: { select: { id: true, name: true } },
      },
    });
  }

  async findById(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
        bouquets: { select: { id: true, name: true } },
      },
    });
    if (!pkg) throw new NotFoundException(`Package ${id} not found`);
    return pkg;
  }

  create(dto: CreatePackageDto) {
    const { bouquetIds, ...rest } = dto;
    return this.prisma.package.create({
      data: {
        ...rest,
        ...(bouquetIds && bouquetIds.length > 0
          ? { bouquets: { connect: bouquetIds.map((bid) => ({ id: bid })) } }
          : {}),
      },
    });
  }

  async update(id: string, dto: UpdatePackageDto) {
    await this.findById(id);
    const { bouquetIds, ...rest } = dto;
    return this.prisma.package.update({
      where: { id },
      data: {
        ...rest,
        // bouquetIds verildiyse tam olarak onlarla değiştir (set). Verilmezse dokunma.
        ...(bouquetIds !== undefined
          ? { bouquets: { set: bouquetIds.map((bid) => ({ id: bid })) } }
          : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.package.delete({ where: { id } });
  }
}
