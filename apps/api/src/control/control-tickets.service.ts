import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function generateTicketNo(): string {
  return `TKT-${Date.now().toString(36).toUpperCase()}`;
}

@Injectable()
export class ControlTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]).then(([data, total]) => ({ data, total, page, limit }));
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  create(dto: { customerId: string; subject: string; priority?: string; category?: string; message: string }) {
    const ticketNo = generateTicketNo();
    return this.prisma.ticket.create({
      data: {
        ticketNo,
        customerId: dto.customerId,
        subject: dto.subject,
        priority: dto.priority ?? 'MEDIUM',
        category: dto.category ?? 'GENERAL',
        messages: {
          create: { content: dto.message, isStaff: true, authorName: 'Admin' },
        },
      },
      include: { customer: { select: { name: true, email: true } } },
    });
  }

  async reply(id: string, content: string, isStaff = true, authorName?: string) {
    await this.findOne(id);
    await this.prisma.ticketMessage.create({
      data: { ticketId: id, content, isStaff, authorName: authorName ?? (isStaff ? 'Admin' : undefined) },
    });
    return this.prisma.ticket.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  async close(id: string) {
    await this.findOne(id);
    return this.prisma.ticket.update({ where: { id }, data: { status: 'CLOSED', resolvedAt: new Date() } });
  }

  async update(id: string, dto: { status?: string; priority?: string }) {
    await this.findOne(id);
    return this.prisma.ticket.update({ where: { id }, data: dto });
  }
}
