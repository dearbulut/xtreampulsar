import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SecurityService } from '../security/security.service';

interface HourlyBandwidth {
  hour: Date;
  bytes_in: bigint;
  bytes_out: bigint;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly securityService?: SecurityService,
  ) {}

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
      offlineStreams,
      idleStreams,
      totalServers,
      onlineServers,
      activeConnections,
      connectionsToday,
    ] = await Promise.all([
      safe('totalUsers',        () => this.prisma.user.count({ where: { deletedAt: null } }), 0),
      safe('activeUsers',       () => this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }), 0),
      safe('totalStreams',      () => this.prisma.stream.count({ where: { isActive: true } }), 0),
      safe('onlineStreams',     () => this.prisma.stream.count({ where: { workerStatus: 'RUNNING' } }), 0),
      safe('offlineStreams',    () => this.prisma.stream.count({ where: { workerStatus: { in: ['STOPPED', 'CRASHED'] } } }), 0),
      safe('idleStreams',       () => this.prisma.stream.count({ where: { workerStatus: 'IDLE' } }), 0),
      safe('totalServers',      () => this.prisma.server.count(), 0),
      safe('onlineServers',     () => this.prisma.server.count({ where: { isOnline: true } }), 0),
      safe('activeConnections', () => this.prisma.connection.count({
        where: { updatedAt: { gte: new Date(Date.now() - 30_000) } },
      }), 0),
      safe('connectionsToday',  () => this.prisma.connection.count({ where: { startedAt: { gte: todayStart } } }), 0),
    ]);

    // unique streams being actively watched
    let activeStreams = 0;
    try {
      const rows = await this.prisma.connection.groupBy({
        by: ['streamId'],
        where: { updatedAt: { gte: new Date(Date.now() - 30_000) } },
      });
      activeStreams = rows.length;
    } catch {}

    // current-hour bandwidth estimate from Redis
    let bandwidthMbps = 0;
    try {
      const hourStr = new Date().toISOString().slice(0, 13);
      const keys = await this.redis.keys(`bw:${hourStr}:*`).catch(() => [] as string[]);
      if (keys.length > 0) {
        const vals = await this.redis.mget(...keys);
        const totalBytes = vals.reduce((s, v) => s + (v ? parseInt(v, 10) : 0), 0);
        const elapsedSec = Math.max(1, new Date().getMinutes() * 60 + new Date().getSeconds());
        bandwidthMbps = Math.round((totalBytes / elapsedSec) * 8 / 1_000_000 * 10) / 10;
      }
    } catch {}

    return {
      users: { total: totalUsers, active: activeUsers },
      streams: { total: totalStreams, online: onlineStreams, offline: offlineStreams, idle: idleStreams },
      servers: { total: totalServers, online: onlineServers },
      connections: { active: activeConnections, today: connectionsToday },
      activeStreams,
      bandwidthMbps,
    };
  }

  async getLiveConnections(page = 1, limit = 50) {
    const activeThreshold = new Date(Date.now() - 30_000);
    try {
      const [raw, total] = await Promise.all([
        this.prisma.connection.findMany({
          where: { updatedAt: { gte: activeThreshold } },
          include: {
            user: { select: { username: true } },
            stream: { select: { name: true, category: { select: { type: true } } } },
          },
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.connection.count({ where: { updatedAt: { gte: activeThreshold } } }),
      ]);

      const items = raw.map((c) => ({
        id: c.id,
        userId: c.userId,
        streamId: c.streamId,
        username: c.user?.username ?? c.userId,
        streamName: c.stream?.name ?? c.streamId,
        streamType: c.stream?.category?.type ?? 'LIVE',
        ip: c.ip,
        userAgent: c.userAgent,
        startedAt: c.startedAt,
        updatedAt: c.updatedAt,
        bytesIn: c.bytesIn.toString(),
        bytesOut: c.bytesOut.toString(),
        duration: Math.floor((Date.now() - c.startedAt.getTime()) / 1000),
      }));

      return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (err) {
      this.logger.error(`getLiveConnections: ${(err as Error).message}`);
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  async kickConnection(connectionId: string): Promise<{ kicked: boolean }> {
    const conn = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      select: { token: true },
    });

    // Blacklist the HLS token so the next segment request returns 403
    if (conn?.token) {
      await this.redis.setex(`kicked:${conn.token}`, 300, '1');
    }

    await this.prisma.connection.delete({ where: { id: connectionId } });
    return { kicked: true };
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

  async getGeoConnections() {
    const cacheKey = 'analytics:geo-connections';
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as unknown[];

    const connections = await this.prisma.connection.findMany({
      where: { endedAt: null },
      select: { ip: true },
      take: 500,
    });

    const uniqueIps = [...new Set(connections.map((c) => c.ip))];
    const countryMap = new Map<string, { country: string; count: number; connections: string[] }>();

    await Promise.allSettled(
      uniqueIps.map(async (ip) => {
        if (!this.securityService) return;
        try {
          const info = await this.securityService.getIpInfo(ip);
          const existing = countryMap.get(info.countryCode);
          if (existing) {
            existing.count++;
            existing.connections.push(ip);
          } else {
            countryMap.set(info.countryCode, { country: info.country, count: 1, connections: [ip] });
          }
        } catch { /* skip unknown IPs */ }
      }),
    );

    const result = [...countryMap.entries()]
      .map(([countryCode, v]) => ({ countryCode, country: v.country, count: v.count }))
      .sort((a, b) => b.count - a.count);

    await this.redis.setex(cacheKey, 30, JSON.stringify(result)).catch(() => {});
    return result;
  }

  async getRevenueReport(startDate: Date, endDate: Date, resellerId?: string) {
    const userWhere: Record<string, unknown> = {
      createdAt: { gte: startDate, lte: endDate },
      role: 'USER',
    };
    if (resellerId) userWhere.resellerId = resellerId;

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        createdAt: true,
        resellerId: true,
        reseller: { select: { id: true, username: true, tier: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build monthly buckets
    const monthMap = new Map<string, { month: string; newUsers: number; totalRevenue: number }>();

    for (const u of users) {
      const m = u.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthMap.has(m)) monthMap.set(m, { month: m, newUsers: 0, totalRevenue: 0 });
      const bucket = monthMap.get(m)!;
      bucket.newUsers++;
      // Revenue estimate: 5€ average per user creation credit
      bucket.totalRevenue += 5;
    }

    // Reseller breakdown
    const resellerMap = new Map<string, { resellerId: string; username: string; tier: string; userCount: number; estimatedRevenue: number }>();
    for (const u of users) {
      if (!u.reseller) continue;
      const r = u.reseller;
      if (!resellerMap.has(r.id)) {
        resellerMap.set(r.id, { resellerId: r.id, username: r.username, tier: r.tier, userCount: 0, estimatedRevenue: 0 });
      }
      const row = resellerMap.get(r.id)!;
      row.userCount++;
      row.estimatedRevenue += 5;
    }

    const totalUsers = users.length;
    const totalRevenue = totalUsers * 5;

    return {
      period: { start: startDate, end: endDate },
      summary: { totalUsers, totalRevenue },
      monthly: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
      byReseller: [...resellerMap.values()].sort((a, b) => b.userCount - a.userCount),
    };
  }

  // ─── Bandwidth Tracking ───────────────────────────────────────────────────

  async trackBandwidth(streamId: string, bytes: number, userId?: string): Promise<void> {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const hourStr = hour.toISOString().slice(0, 13); // YYYY-MM-DDTHH

    const streamKey = `bw:${hourStr}:${streamId}`;
    await this.redis.incrby(streamKey, bytes).catch(() => {});
    await this.redis.expire(streamKey, 7200).catch(() => {}); // 2h TTL

    if (userId) {
      const userKey = `bw:user:${hourStr}:${userId}`;
      await this.redis.incrby(userKey, bytes).catch(() => {});
      await this.redis.expire(userKey, 7200).catch(() => {});
    }
  }

  @Cron('0 * * * *') // every hour
  async flushBandwidthToDb(): Promise<void> {
    const prevHour = new Date();
    prevHour.setHours(prevHour.getHours() - 1, 0, 0, 0);
    const hourStr = prevHour.toISOString().slice(0, 13);

    const keys = await this.redis.keys(`bw:${hourStr}:*`).catch(() => [] as string[]);

    for (const key of keys) {
      const parts = key.split(':');
      // key format: bw:{hourStr}:{streamId}
      if (parts.length < 3) continue;
      const streamId = parts.slice(2).join(':');
      if (streamId.startsWith('user:')) continue; // skip user keys here

      const bytes = await this.redis.get(key).catch(() => '0');
      const bytesNum = parseInt(bytes ?? '0', 10);
      if (bytesNum === 0) continue;

      try {
        await this.prisma.bandwidthLog.upsert({
          where: {
            streamId_serverId_hour: {
              streamId,
              serverId: null as unknown as string,
              hour: prevHour,
            },
          },
          update: { bytesOut: { increment: BigInt(bytesNum) } },
          create: { streamId, hour: prevHour, bytesOut: BigInt(bytesNum) },
        });
        await this.redis.del(key).catch(() => {});
      } catch (err) {
        this.logger.error(`flushBandwidth ${key}: ${(err as Error).message}`);
      }
    }
  }

  async getBandwidthByStream(streamId: string, hours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const logs = await this.prisma.bandwidthLog.findMany({
      where: { streamId, hour: { gte: cutoff } },
      orderBy: { hour: 'asc' },
    });

    return logs.map((l) => ({
      hour: l.hour.toISOString(),
      bytesIn: l.bytesIn.toString(),
      bytesOut: l.bytesOut.toString(),
    }));
  }

  async getBandwidthByUser(userId: string, hours = 24) {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    // Aggregate from Redis live keys + DB historical
    const hourStr = new Date().toISOString().slice(0, 13);
    const liveKey = `bw:user:${hourStr}:${userId}`;
    const liveBytes = parseInt(await this.redis.get(liveKey).catch(() => '0') ?? '0', 10);

    const connections = await this.prisma.connection.findMany({
      where: { userId, startedAt: { gte: cutoff } },
      select: { startedAt: true, bytesOut: true, bytesIn: true },
    });

    const hourMap = new Map<string, { bytesIn: number; bytesOut: number }>();
    for (const c of connections) {
      const h = c.startedAt.toISOString().slice(0, 13);
      const existing = hourMap.get(h) ?? { bytesIn: 0, bytesOut: 0 };
      hourMap.set(h, {
        bytesIn: existing.bytesIn + Number(c.bytesIn),
        bytesOut: existing.bytesOut + Number(c.bytesOut),
      });
    }

    const result = [...hourMap.entries()].map(([hour, v]) => ({
      hour: `${hour}:00:00.000Z`,
      bytesIn: v.bytesIn.toString(),
      bytesOut: v.bytesOut.toString(),
    }));

    if (liveBytes > 0) {
      result.push({ hour: `${hourStr}:00:00.000Z`, bytesIn: '0', bytesOut: liveBytes.toString() });
    }

    return result.sort((a, b) => a.hour.localeCompare(b.hour));
  }

  async getTodayBandwidthTotal(): Promise<{ bytesIn: number; bytesOut: number }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ bytes_in: bigint; bytes_out: bigint }[]>`
      SELECT
        COALESCE(SUM("bytesIn"), 0)::bigint  AS bytes_in,
        COALESCE(SUM("bytesOut"), 0)::bigint AS bytes_out
      FROM connections
      WHERE "startedAt" >= ${todayStart}
    `;
    const r = rows[0] ?? { bytes_in: BigInt(0), bytes_out: BigInt(0) };
    return { bytesIn: Number(r.bytes_in), bytesOut: Number(r.bytes_out) };
  }

  async getConnectionsByHour(): Promise<{ hour: string; label: string; connections: number }[]> {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      const rows = await this.prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
        SELECT
          date_trunc('hour', "startedAt") AS hour,
          COUNT(*)::bigint               AS count
        FROM connections
        WHERE "startedAt" >= ${cutoff}
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      const resultMap = new Map<string, number>();
      for (const r of rows) {
        resultMap.set(r.hour.toISOString().slice(0, 13), Number(r.count));
      }

      // Fill all 24 hours (even zeros)
      const result = [];
      for (let i = 23; i >= 0; i--) {
        const d = new Date();
        d.setHours(d.getHours() - i, 0, 0, 0);
        const key = d.toISOString().slice(0, 13);
        result.push({ hour: key, label: `${d.getHours()}:00`, connections: resultMap.get(key) ?? 0 });
      }
      return result;
    } catch (err) {
      this.logger.error(`getConnectionsByHour: ${(err as Error).message}`);
      return [];
    }
  }

  async getTopCategories(limit = 10): Promise<{ categoryId: string; name: string; type: string; connections: number }[]> {
    try {
      const rows = await this.prisma.connection.groupBy({
        by: ['streamId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit * 5,
      });

      const streamIds = rows.map((r) => r.streamId);
      const streams = await this.prisma.stream.findMany({
        where: { id: { in: streamIds } },
        select: { id: true, categoryId: true, category: { select: { name: true, type: true } } },
      });
      const streamCatMap = new Map(streams.map((s) => [s.id, s]));

      const catMap = new Map<string, { categoryId: string; name: string; type: string; connections: number }>();
      for (const r of rows) {
        const s = streamCatMap.get(r.streamId);
        if (!s?.category) continue;
        const existing = catMap.get(s.categoryId);
        if (existing) {
          existing.connections += r._count.id;
        } else {
          catMap.set(s.categoryId, { categoryId: s.categoryId, name: s.category.name, type: s.category.type, connections: r._count.id });
        }
      }

      return [...catMap.values()].sort((a, b) => b.connections - a.connections).slice(0, limit);
    } catch (err) {
      this.logger.error(`getTopCategories: ${(err as Error).message}`);
      return [];
    }
  }

  async getUserGrowth(days = 30): Promise<{ date: string; newUsers: number; cumulative: number }[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);

      const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT
          date_trunc('day', "createdAt") AS day,
          COUNT(*)::bigint              AS count
        FROM users
        WHERE "createdAt" >= ${cutoff}
          AND "deletedAt" IS NULL
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      const dayMap = new Map<string, number>();
      for (const r of rows) {
        dayMap.set(r.day.toISOString().slice(0, 10), Number(r.count));
      }

      const result = [];
      let cumulative = 0;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const newUsers = dayMap.get(key) ?? 0;
        cumulative += newUsers;
        result.push({ date: key, newUsers, cumulative });
      }
      return result;
    } catch (err) {
      this.logger.error(`getUserGrowth: ${(err as Error).message}`);
      return [];
    }
  }

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const activeThreshold = new Date(Date.now() - 30_000);

    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); }
      catch (err) { this.logger.error(`getDashboardStats[${label}]: ${(err as Error).message}`); return fallback; }
    };

    const [
      totalUsers,
      activeUsers,
      expiredUsers,
      newUsersToday,
      totalStreams,
      healthyStreams,
      activeConnections,
      connectionsToday,
      streamsUp,
      streamsDown,
      streamsDegraded,
    ] = await Promise.all([
      safe('totalUsers',      () => this.prisma.user.count({ where: { deletedAt: null } }), 0),
      safe('activeUsers',     () => this.prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }), 0),
      safe('expiredUsers',    () => this.prisma.user.count({ where: { deletedAt: null, expiresAt: { lt: now } } }), 0),
      safe('newUsersToday',   () => this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }), 0),
      safe('totalStreams',    () => this.prisma.stream.count({ where: { isActive: true } }), 0),
      safe('healthyStreams',  () => this.prisma.stream.count({ where: { isActive: true, uptimePercent: { gte: 95 } } }), 0),
      safe('activeConns',    () => this.prisma.connection.count({ where: { updatedAt: { gte: activeThreshold } } }), 0),
      safe('connsToday',     () => this.prisma.connection.count({ where: { startedAt: { gte: todayStart } } }), 0),
      safe('streamsUp',      () => this.prisma.stream.count({ where: { isActive: true, healthStatus: 'HEALTHY' } }), 0),
      safe('streamsDown',    () => this.prisma.stream.count({ where: { isActive: true, healthStatus: 'UNHEALTHY' } }), 0),
      safe('streamsDeg',     () => this.prisma.streamHealthLog
        .groupBy({ by: ['streamId'], where: { checkedAt: { gte: new Date(Date.now() - 10 * 60_000) }, status: 'degraded' } })
        .then((r) => r.length), 0),
    ]);

    let activeStreams = 0;
    try {
      activeStreams = (await this.prisma.connection.groupBy({
        by: ['streamId'],
        where: { updatedAt: { gte: activeThreshold } },
      })).length;
    } catch {}

    let bandwidthMbps = 0;
    try {
      const hourStr = new Date().toISOString().slice(0, 13);
      const keys = await this.redis.keys(`bw:${hourStr}:*`).catch(() => [] as string[]);
      if (keys.length > 0) {
        const vals = await this.redis.mget(...keys);
        const totalBytes = vals.reduce((s, v) => s + (v ? parseInt(v, 10) : 0), 0);
        const elapsedSec = Math.max(1, new Date().getMinutes() * 60 + new Date().getSeconds());
        bandwidthMbps = Math.round((totalBytes / elapsedSec) * 8 / 1_000_000 * 10) / 10;
      }
    } catch {}

    return {
      activeConnections,
      activeStreams,
      bandwidthMbps,
      totalUsers,
      activeUsers,
      expiredUsers,
      totalStreams,
      healthyStreams,
      newUsersToday,
      connectionsToday,
      streamsUp,
      streamsDown,
      streamsDegraded,
    };
  }

  async getConnectionsChart(hours: number = 24): Promise<{ hour: string; connections: number; bandwidth: number }[]> {
    try {
      const cutoff = new Date(Date.now() - hours * 3600_000);

      const [connRows, bwRows] = await Promise.all([
        this.prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
          SELECT
            date_trunc('hour', "startedAt") AS hour,
            COUNT(*)::bigint AS count
          FROM connections
          WHERE "startedAt" >= ${cutoff}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        this.prisma.bandwidthLog.groupBy({
          by: ['hour'],
          where: { hour: { gte: cutoff } },
          _sum: { bytesIn: true, bytesOut: true },
        }),
      ]);

      const connMap = new Map<string, number>();
      for (const r of connRows) connMap.set(r.hour.toISOString().slice(0, 13), Number(r.count));

      const bwMap = new Map<string, number>();
      for (const r of bwRows) {
        const key = r.hour.toISOString().slice(0, 13);
        const mb = (Number(r._sum.bytesIn ?? 0) + Number(r._sum.bytesOut ?? 0)) / 1_000_000;
        bwMap.set(key, Math.round(mb * 10) / 10);
      }

      const result = [];
      for (let i = hours - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 3600_000);
        d.setMinutes(0, 0, 0);
        const key = d.toISOString().slice(0, 13);
        result.push({ hour: d.toISOString(), connections: connMap.get(key) ?? 0, bandwidth: bwMap.get(key) ?? 0 });
      }
      return result;
    } catch (err) {
      this.logger.error(`getConnectionsChart: ${(err as Error).message}`);
      return [];
    }
  }

  async getRecentActivity(limit = 20): Promise<{ id: string; type: string; description: string; user: string; createdAt: Date }[]> {
    try {
      const logs = await this.prisma.userActivityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { username: true } } },
      });

      const ACTION_LABELS: Record<string, string> = {
        LOGIN:            'Giriş yapıldı',
        LOGOUT:           'Çıkış yapıldı',
        STREAM_START:     'Stream izlemeye başladı',
        STREAM_END:       'Stream izlemeyi bitirdi',
        STREAM_STOP:      'Stream durduruldu',
        CREATED:          'Hesap oluşturuldu',
        PASSWORD_CHANGED: 'Şifre değiştirildi',
        PASSWORD_CHANGE:  'Şifre değiştirildi',
        SUSPENDED:        'Hesap askıya alındı',
        REGISTER:         'Hesap oluşturuldu',
      };

      return logs.map((log) => {
        const username = log.user?.username ?? 'Bilinmeyen';
        return {
          id: log.id,
          type: log.action,
          description: ACTION_LABELS[log.action] ?? log.action,
          user: username,
          createdAt: log.createdAt,
        };
      });
    } catch (err) {
      this.logger.error(`getRecentActivity: ${(err as Error).message}`);
      return [];
    }
  }
}
