import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface HourlyBandwidth {
  hour: Date;
  bytes_in: bigint;
  bytes_out: bigint;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        this.logger.error(`getDashboard[${label}]: ${(err as Error).message}`);
        return fallback;
      }
    };

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
      safe('totalUsers',        () => this.prisma.user.count({ where: { deletedAt: null } }), 0),
      safe('activeUsers',       () => this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }), 0),
      safe('totalStreams',      () => this.prisma.stream.count({ where: { isActive: true } }), 0),
      safe('onlineStreams',     () => this.prisma.stream.count({ where: { isActive: true, status: 'ONLINE' } }), 0),
      safe('totalServers',      () => this.prisma.server.count(), 0),
      safe('onlineServers',     () => this.prisma.server.count({ where: { isOnline: true } }), 0),
      safe('activeConnections', () => this.prisma.connection.count({
        where: { updatedAt: { gte: new Date(Date.now() - 30_000) } },
      }), 0),
      safe('connectionsToday',  () => this.prisma.connection.count({ where: { startedAt: { gte: todayStart } } }), 0),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      streams: { total: totalStreams, online: onlineStreams },
      servers: { total: totalServers, online: onlineServers },
      connections: { active: activeConnections, today: connectionsToday },
    };
  }

  async getLiveConnections(page = 1, limit = 50) {
    const activeThreshold = new Date(Date.now() - 30_000);
    try {
      const [items, total] = await Promise.all([
        this.prisma.connection.findMany({
          where: { updatedAt: { gte: activeThreshold } },
          include: {
            user: { select: { id: true, username: true } },
            stream: { select: { id: true, name: true, status: true } },
            server: { select: { id: true, name: true, ip: true } },
          },
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.connection.count({ where: { updatedAt: { gte: activeThreshold } } }),
      ]);
      return { items, total, page, limit };
    } catch (err) {
      this.logger.error(`getLiveConnections: ${(err as Error).message}`);
      return { items: [], total: 0, page, limit };
    }
  }

  async getBandwidthChart(): Promise<{ hour: string; bytesIn: string; bytesOut: string }[]> {
    try {
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
    } catch (err) {
      this.logger.error(`getBandwidthChart: ${(err as Error).message}`);
      return [];
    }
  }

  async getTopStreams(limit = 10) {
    try {
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
    } catch (err) {
      this.logger.error(`getTopStreams: ${(err as Error).message}`);
      return [];
    }
  }

  async getTopUsers(limit = 10) {
    try {
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
    } catch (err) {
      this.logger.error(`getTopUsers: ${(err as Error).message}`);
      return [];
    }
  }

  async getServerStats() {
    try {
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
    } catch (err) {
      this.logger.error(`getServerStats: ${(err as Error).message}`);
      return [];
    }
  }
}
