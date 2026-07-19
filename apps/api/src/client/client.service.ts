import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { activeConnectionWhere } from '../user/user.repository';

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  // Son kullanıcının kendi abonelik özeti + oynatma sunucu bilgisi.
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        status: true,
        expiresAt: true,
        maxConnections: true,
        isTrial: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const activeConnections = await this.prisma.connection.count({
      where: { userId, ...activeConnectionWhere() },
    });

    const serverUrl =
      (await this.settings.getActiveServerUrl()) ||
      this.config.get<string>('server.url') ||
      'http://localhost';
    const serverPort = this.config.get<number>('server.port') ?? 8080;

    return { ...user, activeConnections, serverUrl, serverPort };
  }

  // Kendi aktif bağlantıları (yalnız gerçekten aktif olanlar).
  async getConnections(userId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { ...activeConnectionWhere(), userId },
      select: {
        id: true,
        ip: true,
        startedAt: true,
        stream: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const now = Date.now();
    return connections.map((c) => ({
      id: c.id,
      ip: c.ip,
      startedAt: c.startedAt,
      durationSeconds: Math.floor((now - c.startedAt.getTime()) / 1000),
      stream: c.stream,
    }));
  }

  // Son kullanıcı: kanal sorunu bildir veya yeni kanal iste.
  async createRequest(
    userId: string,
    dto: { type: 'REPORT' | 'NEW_CHANNEL'; streamId?: string; title: string; message?: string },
  ) {
    let streamId: string | null = null;
    if (dto.type === 'REPORT' && dto.streamId) {
      const st = await this.prisma.stream.findUnique({ where: { id: dto.streamId }, select: { id: true } });
      streamId = st?.id ?? null;
    }
    return this.prisma.clientRequest.create({
      data: {
        type: dto.type,
        userId,
        streamId,
        title: dto.title.trim(),
        message: dto.message?.trim() || null,
      },
    });
  }

  async getMyRequests(userId: string) {
    return this.prisma.clientRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        stream: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: { id: true, sender: true, body: true, createdAt: true } },
      },
      take: 50,
    });
  }

  // Son kullanıcı: kendi talebine cevap mesajı ekler (thread) + talebi yeniden açar.
  async addMyRequestMessage(userId: string, requestId: string, body: string) {
    const req = await this.prisma.clientRequest.findFirst({
      where: { id: requestId, userId },
      select: { id: true },
    });
    if (!req) throw new NotFoundException('Talep bulunamadı');
    const text = (body || '').trim();
    if (!text) throw new BadRequestException('Mesaj boş olamaz');
    const msg = await this.prisma.clientRequestMessage.create({
      data: { requestId, sender: 'USER', body: text.slice(0, 2000) },
      select: { id: true, sender: true, body: true, createdAt: true },
    });
    await this.prisma.clientRequest.update({ where: { id: requestId }, data: { status: 'OPEN', resolvedAt: null } });
    return msg;
  }
}
