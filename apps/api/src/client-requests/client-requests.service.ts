import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

type ReqStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';

@Injectable()
export class ClientRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async list(params: { status?: string; type?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 50;
    const where: { status?: ReqStatus; type?: 'REPORT' | 'NEW_CHANNEL' } = {};
    if (params.status) where.status = params.status as ReqStatus;
    if (params.type) where.type = params.type as 'REPORT' | 'NEW_CHANNEL';

    const [items, total] = await Promise.all([
      this.prisma.clientRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true } },
          stream: { select: { id: true, name: true } },
          messages: { orderBy: { createdAt: 'asc' }, select: { id: true, sender: true, body: true, createdAt: true } },
        },
      }),
      this.prisma.clientRequest.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async updateStatus(id: string, status: ReqStatus, adminNote?: string) {
    return this.prisma.clientRequest.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote ?? undefined,
        resolvedAt: status === 'OPEN' ? null : new Date(),
      },
    });
  }

  /** Bir talep için AI yanıt taslağı üretir (kaydetmez; admin gözden geçirip adminNote'a yazar). */
  async aiSuggest(id: string): Promise<{ reply: string }> {
    const req = await this.prisma.clientRequest.findUnique({
      where: { id },
      select: {
        title: true, message: true, type: true,
        messages: { orderBy: { createdAt: 'asc' }, select: { sender: true, body: true } },
      },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    return this.ai.suggestReply({ title: req.title, message: req.message, type: req.type, messages: req.messages });
  }

  /** Admin talebe cevap mesajı ekler (thread). */
  async addMessage(id: string, body: string) {
    const req = await this.prisma.clientRequest.findUnique({ where: { id }, select: { id: true } });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    const text = (body || '').trim();
    if (!text) throw new NotFoundException('Mesaj boş olamaz');
    return this.prisma.clientRequestMessage.create({
      data: { requestId: id, sender: 'ADMIN', body: text.slice(0, 2000) },
      select: { id: true, sender: true, body: true, createdAt: true },
    });
  }

  async stats(): Promise<{ openReports: number; openRequests: number }> {
    const [openReports, openRequests] = await Promise.all([
      this.prisma.clientRequest.count({ where: { type: 'REPORT', status: 'OPEN' } }),
      this.prisma.clientRequest.count({ where: { type: 'NEW_CHANNEL', status: 'OPEN' } }),
    ]);
    return { openReports, openRequests };
  }
}
