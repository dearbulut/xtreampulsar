import { Injectable, NotFoundException } from '@nestjs/common';
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
}
