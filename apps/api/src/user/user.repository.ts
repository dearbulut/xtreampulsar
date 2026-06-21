import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateConnectionData {
  userId: string;
  streamId: string;
  ip: string;
  userAgent?: string;
  serverId?: string;
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
