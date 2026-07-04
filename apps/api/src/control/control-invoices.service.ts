import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function generateInvoiceNo(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000 + 10000);
  return `INV-${year}-${rand}`;
}

interface CreateInvoiceDto {
  customerId: string;
  amount: number;
  currency?: string;
  plan?: string;
  period?: string;
  dueAt?: string;
}

@Injectable()
export class ControlInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, email: true } } },
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({ where, _sum: { amount: true } }),
    ]).then(([data, total, agg]) => ({ data, total, page, limit, totalAmount: agg._sum.amount ?? 0 }));
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true, email: true, company: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  create(dto: CreateInvoiceDto) {
    const invoiceNo = generateInvoiceNo();
    return this.prisma.invoice.create({
      data: {
        invoiceNo,
        customerId: dto.customerId,
        amount: dto.amount,
        currency: dto.currency ?? 'EUR',
        plan: dto.plan,
        period: dto.period,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: { customer: { select: { name: true, email: true } } },
    });
  }

  async markPaid(id: string, stripeId?: string) {
    await this.findOne(id);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), ...(stripeId && { stripeId }) },
    });
  }

  async cancel(id: string) {
    await this.findOne(id);
    return this.prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.invoice.delete({ where: { id } });
  }
}
