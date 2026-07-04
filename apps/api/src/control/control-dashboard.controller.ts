import { Controller, Get, UseGuards } from '@nestjs/common';
import { ControlJwtGuard } from './control-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('control/dashboard')
@UseGuards(ControlJwtGuard)
export class ControlDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      customers,
      licenses,
      tickets,
      invoices,
      pendingInvoices,
      openTickets,
      activeLicenses,
      paidInvoices,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customerLicense.count(),
      this.prisma.ticket.count(),
      this.prisma.invoice.count(),
      this.prisma.invoice.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.customerLicense.count({ where: { status: 'ACTIVE' } }),
      this.prisma.invoice.findMany({
        where: { status: 'PAID', paidAt: { gte: sixMonthsAgo } },
        select: { amount: true, paidAt: true },
      }),
    ]);

    // Son 6 ay aylık gelir haritası
    const monthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }
    for (const inv of paidInvoices) {
      if (!inv.paidAt) continue;
      const d = new Date(inv.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + inv.amount);
      }
    }
    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

    const recentCustomers = await this.prisma.customer.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    const recentTickets = await this.prisma.ticket.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true } } },
    });

    return {
      counts: { customers, licenses, tickets, invoices },
      openTickets,
      pendingRevenue: pendingInvoices._sum.amount ?? 0,
      activeLicenses,
      monthlyRevenue,
      recentCustomers,
      recentTickets,
    };
  }
}
