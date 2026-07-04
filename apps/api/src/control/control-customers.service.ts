import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCustomerDto {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  notes?: string;
  source?: string;
}

interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: string;
}

@Injectable()
export class ControlCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(page = 1, limit = 20, search?: string) {
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
      : {};
    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { licenses: true, tickets: true, invoices: true } } } }),
      this.prisma.customer.count({ where }),
    ]).then(([data, total]) => ({ data, total, page, limit }));
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        licenses: { orderBy: { createdAt: 'desc' } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 10 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }
}
