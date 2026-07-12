import { Injectable, Logger, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { activeConnectionWhere } from '../user/user.repository';
import { REDIS_CLIENT } from '../redis/redis.module';

interface IpInfo {
  country: string;
  countryCode: string;
  isp: string;
  isProxy: boolean;
  isHosting: boolean;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getIpInfo(ip: string): Promise<IpInfo> {
    const cacheKey = `ipinfo:${ip}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as IpInfo;
    }

    try {
      const res = await fetch(
        `http://ip-api.com/json/${ip}?fields=country,countryCode,isp,proxy,hosting`,
        { signal: AbortSignal.timeout(4000) },
      );
      const data = (await res.json()) as {
        country?: string;
        countryCode?: string;
        isp?: string;
        proxy?: boolean;
        hosting?: boolean;
      };

      const info: IpInfo = {
        country: data.country ?? 'Unknown',
        countryCode: data.countryCode ?? 'XX',
        isp: data.isp ?? 'Unknown',
        isProxy: data.proxy ?? false,
        isHosting: data.hosting ?? false,
      };

      await this.redis.setex(cacheKey, 3600, JSON.stringify(info)).catch(() => {});
      return info;
    } catch (err) {
      this.logger.warn(`IP info lookup failed for ${ip}: ${(err as Error).message}`);
      return { country: 'Unknown', countryCode: 'XX', isp: 'Unknown', isProxy: false, isHosting: false };
    }
  }

  async checkIpAllowed(
    ip: string,
    serverId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      return { allowed: true };
    }

    // 1. Manual ban check (Redis first, then DB)
    if (await this.isIpBanned(ip)) {
      return { allowed: false, reason: 'IP banned' };
    }

    // 2. Global VPN/proxy check from settings
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const info = await this.getIpInfo(ip);

    if (settings?.blockVpnProxy && (info.isProxy || info.isHosting)) {
      return { allowed: false, reason: 'VPN/Proxy not allowed' };
    }

    // 3. Server-specific guard checks
    if (serverId) {
      const guard = await this.prisma.serverGuard.findUnique({ where: { serverId } });
      if (guard) {
        if (guard.whitelistIps.includes(ip)) {
          return { allowed: true };
        }
        if (guard.blockVpnProxy && (info.isProxy || info.isHosting)) {
          return { allowed: false, reason: 'VPN/Proxy blocked by server guard' };
        }
        if (guard.geoBlockedCountries.length > 0 && guard.geoBlockedCountries.includes(info.countryCode)) {
          return { allowed: false, reason: `Country ${info.countryCode} is geo-blocked` };
        }
      }
    }

    return { allowed: true };
  }

  async banIp(
    ip: string,
    reason: string,
    durationMinutes?: number,
    bannedBy?: string,
  ): Promise<void> {
    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60_000)
      : new Date(Date.now() + 365 * 24 * 60 * 60_000);

    await this.prisma.blockedIp.upsert({
      where: { id: `global-${ip}` },
      update: { reason, bannedBy, expiresAt },
      create: { id: `global-${ip}`, ip, reason, bannedBy, expiresAt },
    });

    const ttl = durationMinutes ? durationMinutes * 60 : 365 * 24 * 3600;
    await this.redis.setex(`banned:${ip}`, ttl, reason).catch(() => {});
    this.logger.log(`Banned IP ${ip} for ${durationMinutes ?? 'permanent'} min: ${reason}`);
  }

  async unbanIp(ip: string): Promise<void> {
    await this.prisma.blockedIp.deleteMany({ where: { ip, serverId: null } });
    await this.redis.del(`banned:${ip}`).catch(() => {});
    this.logger.log(`Unbanned IP ${ip}`);
  }

  async isIpBanned(ip: string): Promise<boolean> {
    const redisHit = await this.redis.exists(`banned:${ip}`).catch(() => 0);
    if (redisHit) return true;

    const dbHit = await this.prisma.blockedIp.findFirst({
      where: { ip, serverId: null, expiresAt: { gt: new Date() } },
    });
    if (dbHit) {
      await this.redis
        .setex(`banned:${ip}`, Math.ceil((dbHit.expiresAt.getTime() - Date.now()) / 1000), dbHit.reason)
        .catch(() => {});
    }
    return !!dbHit;
  }

  async listBannedIps(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.blockedIp.findMany({
        where: { serverId: null },
        orderBy: { blockedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.blockedIp.count({ where: { serverId: null } }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getGeoStats() {
    const connections = await this.prisma.connection.findMany({
      where: activeConnectionWhere(),
      select: { ip: true },
      take: 500,
    });

    const uniqueIps = [...new Set(connections.map((c) => c.ip))];
    const countryMap = new Map<string, { country: string; count: number }>();

    await Promise.allSettled(
      uniqueIps.map(async (ip) => {
        const cached = await this.redis.get(`ipinfo:${ip}`).catch(() => null);
        if (!cached) return;
        const info = JSON.parse(cached) as IpInfo;
        const existing = countryMap.get(info.countryCode);
        if (existing) {
          existing.count++;
        } else {
          countryMap.set(info.countryCode, { country: info.country, count: 1 });
        }
      }),
    );

    return [...countryMap.entries()]
      .map(([code, v]) => ({ countryCode: code, country: v.country, connections: v.count }))
      .sort((a, b) => b.connections - a.connections);
  }
}
