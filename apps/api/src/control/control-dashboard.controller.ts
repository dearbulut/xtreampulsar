import { Controller, Get, UseGuards } from '@nestjs/common';
import { ControlJwtGuard } from './control-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('control/dashboard')
@UseGuards(ControlJwtGuard)
export class ControlDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats() {
    const [customers, licenses, tickets, invoices, pendingInvoices, openTickets] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customerLicense.count(),
      this.prisma.ticket.count(),
      this.prisma.invoice.count(),
      this.prisma.invoice.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
    ]);
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
      recentCustomers,
      recentTickets,
    };
  }
}
