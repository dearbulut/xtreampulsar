import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

async function generateTicketNo(prisma: PrismaService): Promise<string> {
  const last = await prisma.ticket.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { ticketNo: true },
  });
  if (!last) return '#1001';
  const num = parseInt(last.ticketNo.replace('#', ''), 10);
  return isNaN(num) ? `#${Date.now().toString(36).toUpperCase()}` : `#${num + 1}`;
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
    return generateTicketNo(this.prisma).then((ticketNo) =>
      this.prisma.ticket.create({
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
      }),
    );
  }

  async createFromPanel(dto: {
    customerId: string;
    licenseId: string;
    subject: string;
    message: string;
    category?: string;
    priority?: string;
    panelVersion?: string;
    panelUrl?: string;
    serverIp?: string;
  }) {
    const ticketNo = await generateTicketNo(this.prisma);
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNo,
        customerId: dto.customerId,
        licenseId: dto.licenseId,
        subject: dto.subject,
        priority: dto.priority ?? 'MEDIUM',
        category: dto.category ?? 'GENERAL',
        panelUrl: dto.panelUrl,
        panelVersion: dto.panelVersion,
        serverIp: dto.serverIp,
        messages: {
          create: { content: dto.message, isStaff: false },
        },
      },
      select: { id: true, ticketNo: true, status: true },
    });
    return { ticketId: ticket.id, ticketNo: ticket.ticketNo, status: ticket.status };
  }

  findByLicense(licenseId: string) {
    return this.prisma.ticket.findMany({
      where: { licenseId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }).then((tickets) =>
      tickets.map((t) => ({
        ticketId: t.id,
        ticketNo: t.ticketNo,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        category: t.category,
        createdAt: t.createdAt,
        lastMessage: t.messages[0] ?? null,
      })),
    );
  }

  async findOneForLicense(id: string, licenseId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, licenseId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new ForbiddenException('Ticket not found');
    return ticket;
  }

  async closeForLicense(id: string, licenseId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id, licenseId }, select: { id: true } });
    if (!ticket) throw new ForbiddenException('Ticket not found');
    return this.prisma.ticket.update({ where: { id }, data: { status: 'CLOSED', resolvedAt: new Date() } });
  }

  async reply(id: string, content: string, isStaff = true, authorName?: string) {
    const ticket = await this.findOne(id);
    await this.prisma.ticketMessage.create({
      data: { ticketId: id, content, isStaff, authorName: authorName ?? (isStaff ? 'Admin' : undefined) },
    });
    // Admin yanıtı → IN_PROGRESS; müşteri yanıtı → OPEN (staff already in progress, keep)
    const newStatus = isStaff && ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
    return this.prisma.ticket.update({ where: { id }, data: { status: newStatus, updatedAt: new Date() } });
  }

  async resolve(id: string) {
    await this.findOne(id);
    return this.prisma.ticket.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
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
