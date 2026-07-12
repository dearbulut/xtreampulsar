import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// HLS'te istemci "ayrıldım" demez; aktiflik son aktivite (Connection.updatedAt) ile
// ölçülür. updatedAt her segment/manifest isteğinde (findOrCreateConnection reuse +
// serveHlsSegment heartbeat) tazelenir. Bu süreden eski + endedAt=null bağlantılar
// "hayalet" sayılır ve kapatılır. 90sn: canlı izleyen ~10-30sn'de tazeler, ağ
// dalgalanmasında yanlış düşme yok, hayaleti hızlı temizler.
export const STALE_CONNECTION_MS = 90_000;

export interface CreateConnectionData {
  userId: string;
  streamId: string;
  ip: string;
  userAgent?: string;
  serverId?: string;
  token?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Yalnız GERÇEKTEN aktif (endedAt=null VE son STALE_CONNECTION_MS içinde aktivite)
  // bağlantıları sayar — hayalet kayıtlar maxConnections kotasını bloke etmesin.
  countActiveConnections(userId: string): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_CONNECTION_MS);
    return this.prisma.connection.count({
      where: { userId, endedAt: null, updatedAt: { gte: cutoff } },
    });
  }

  // Hayalet bağlantıları kapat (cron). Döner: kapatılan sayısı.
  closeStaleConnections(): Promise<{ count: number }> {
    const cutoff = new Date(Date.now() - STALE_CONNECTION_MS);
    return this.prisma.connection.updateMany({
      where: { endedAt: null, updatedAt: { lt: cutoff } },
      data: { endedAt: new Date() },
    });
  }

  createConnection(data: CreateConnectionData) {
    return this.prisma.connection.create({ data });
  }

  // Returns existing open connection for the same user+stream, or creates one.
  // This prevents a new DB row for every HLS segment request.
  async findOrCreateConnection(data: CreateConnectionData): Promise<{ id: string; token: string | null; isNew: boolean }> {
    const existing = await this.prisma.connection.findFirst({
      where: { userId: data.userId, streamId: data.streamId, endedAt: null },
      select: { id: true, token: true },
    });

    if (existing) {
      await this.prisma.connection.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      return { id: existing.id, token: existing.token ?? null, isNew: false };
    }

    const conn = await this.prisma.connection.create({ data });
    return { id: conn.id, token: conn.token ?? null, isNew: true };
  }

  async closeConnection(connectionId: string): Promise<void> {
    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { endedAt: new Date() },
    });
  }

  closeAllUserConnections(userId: string): Promise<{ count: number }> {
    return this.prisma.connection.updateMany({
      where: { userId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }
}
