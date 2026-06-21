import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HourlyBandwidth {
  hour: Date;
  bytes_in: bigint;
  bytes_out: bigint;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalStreams,
      onlineStreams,
      totalServers,
      onlineServers,
      activeConnections,
      connectionsToday,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }),
      this.prisma.stream.count({ where: { isActive: true } }),
      this.prisma.stream.count({ where: { isActive: true, status: 'ONLINE' } }),
      this.prisma.server.count(),
      this.prisma.server.count({ where: { isOnline: true } }),
      this.prisma.connection.count({ where: { endedAt: null } }),
      this.prisma.connection.count({ where: { startedAt: { gte: todayStart } } }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      streams: { total: totalStreams, online: onlineStreams },
      servers: { total: totalServers, online: onlineServers },
      connections: { active: activeConnections, today: connectionsToday },
    };
  }

  async getLiveConnections(page = 1, limit = 50) {
    const [items, total] = await Promise.all([
      this.prisma.connection.findMany({
        where: { endedAt: null },
        include: {
          user: { select: { id: true, username: true } },
          stream: { select: { id: true, name: true, status: true } },
          server: { select: { id: true, name: true, ip: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.connection.count({ where: { endedAt: null } }),
    ]);

    return { items, total, page, limit };
  }

  async getBandwidthChart(): Promise<{ hour: string; bytesIn: string; bytesOut: string }[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const rows = await this.prisma.$queryRaw<HourlyBandwidth[]>`
      SELECT
        date_trunc('hour', "startedAt") AS hour,
        SUM("bytesIn")::bigint           AS bytes_in,
        SUM("bytesOut")::bigint          AS bytes_out
      FROM connections
      WHERE "startedAt" >= ${cutoff}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return rows.map((r) => ({
      hour: r.hour.toISOString(),
      bytesIn: r.bytes_in.toString(),
      bytesOut: r.bytes_out.toString(),
    }));
  }

  async getTopStreams(limit = 10) {
    const rows = await this.prisma.connection.groupBy({
      by: ['streamId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const streamIds = rows.map((r) => r.streamId);
    const streams = await this.prisma.stream.findMany({
      where: { id: { in: streamIds } },
      select: { id: true, name: true, status: true, category: { select: { name: true } } },
    });

    const streamMap = new Map(streams.map((s) => [s.id, s]));

    return rows.map((r) => ({
      stream: streamMap.get(r.streamId),
      connections: r._count.id,
    }));
  }

  async getTopUsers(limit = 10) {
    const rows = await this.prisma.connection.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const userIds = rows.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, status: true, resellerId: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      user: userMap.get(r.userId),
      connections: r._count.id,
    }));
  }

  async getServerStats() {
    const servers = await this.prisma.server.findMany({
      include: {
        _count: { select: { connections: { where: { endedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });

    return servers.map((s) => ({
      id: s.id,
      name: s.name,
      ip: s.ip,
      isOnline: s.isOnline,
      responseTime: s.responseTime,
      activeConnections: s._count.connections,
      maxClients: s.maxClients,
      utilization: s.maxClients > 0 ? (s._count.connections / s.maxClients) * 100 : 0,
    }));
  }
}
