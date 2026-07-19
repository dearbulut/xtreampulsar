import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ReqStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';

@Injectable()
export class ClientRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async stats(): Promise<{ openReports: number; openRequests: number }> {
    const [openReports, openRequests] = await Promise.all([
      this.prisma.clientRequest.count({ where: { type: 'REPORT', status: 'OPEN' } }),
      this.prisma.clientRequest.count({ where: { type: 'NEW_CHANNEL', status: 'OPEN' } }),
    ]);
    return { openReports, openRequests };
  }
}
