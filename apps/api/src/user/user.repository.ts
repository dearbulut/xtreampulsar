import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  countActiveConnections(userId: string): Promise<number> {
    return this.prisma.connection.count({
      where: { userId, endedAt: null },
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
