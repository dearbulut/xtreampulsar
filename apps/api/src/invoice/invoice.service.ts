import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async panelCurrency(): Promise<string> {
    const s = await this.prisma.settings
      .findUnique({ where: { id: 'singleton' }, select: { currency: true } })
      .catch(() => null);
    return s?.currency || 'TRY';
  }

  /** INV-YYYY-NNNN (o yılın sıralı numarası). Çakışmada tekrar dener. */
  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.panelInvoice.count({ where: { createdAt: { gte: start } } });
      const candidate = `INV-${year}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.prisma.panelInvoice.findUnique({ where: { number: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    return `INV-${year}-${Date.now().toString().slice(-6)}`;
  }

  async create(dto: {
    customerName?: string;
    customerEmail?: string;
    description?: string;
    amount?: number;
    currency?: string;
    notes?: string;
    source?: string;
    sourceId?: string;
  }) {
    const customerName = (dto.customerName ?? '').trim();
    const description = (dto.description ?? '').trim();
    if (!customerName) throw new BadRequestException('Müşteri adı gerekli');
    if (!description) throw new BadRequestException('Açıklama gerekli');
    const amount = Number(dto.amount);
    if (!isFinite(amount) || amount < 0) throw new BadRequestException('Geçersiz tutar');

    const number = await this.nextNumber();
    return this.prisma.panelInvoice.create({
      data: {
        number,
        customerName,
        customerEmail: (dto.customerEmail ?? '').trim() || null,
        description,
        amount,
        currency: (dto.currency ?? '').trim() || (await this.panelCurrency()),
        notes: (dto.notes ?? '').trim() || null,
        source: dto.source === 'STORE' ? 'STORE' : 'MANUAL',
        sourceId: dto.sourceId ?? null,
      },
    });
  }

  /** Karşılanmış bir mağaza siparişinden fatura üretir. */
  async createFromStoreOrder(orderId: string) {
    const order = await this.prisma.storeOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const existing = await this.prisma.panelInvoice.findFirst({ where: { source: 'STORE', sourceId: orderId } });
    if (existing) return existing; // idempotent: aynı sipariş için tek fatura
    return this.create({
      customerName: order.contactEmail,
      customerEmail: order.contactEmail,
      description: order.packageName,
      amount: order.price,
      source: 'STORE',
      sourceId: orderId,
    });
  }

  async list(params: { status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 50;
    const where = params.status ? { status: params.status } : {};
    const [items, total, paidAgg, unpaidAgg] = await Promise.all([
      this.prisma.panelInvoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.panelInvoice.count({ where }),
      this.prisma.panelInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      this.prisma.panelInvoice.aggregate({ where: { status: 'UNPAID' }, _sum: { amount: true } }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPaid: paidAgg._sum.amount ?? 0,
      totalUnpaid: unpaidAgg._sum.amount ?? 0,
    };
  }

  async get(id: string) {
    const inv = await this.prisma.panelInvoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Fatura bulunamadı');
    return inv;
  }

  async setStatus(id: string, status: 'PAID' | 'UNPAID' | 'CANCELLED') {
    await this.get(id);
    return this.prisma.panelInvoice.update({
      where: { id },
      data: { status, paidAt: status === 'PAID' ? new Date() : null },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.panelInvoice.delete({ where: { id } });
    return { success: true };
  }
}
