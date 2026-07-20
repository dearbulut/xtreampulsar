import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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

  // Anti-restream blokları (xbrute:block:<ip>) — brute-force/scanner oto-blokları.
  async listXtreamBlocks(): Promise<Array<{ ip: string; ttl: number }>> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', 'xbrute:block:*', 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    const out: Array<{ ip: string; ttl: number }> = [];
    for (const k of keys) {
      const ttl = await this.redis.ttl(k).catch(() => -1);
      out.push({ ip: k.replace('xbrute:block:', ''), ttl });
    }
    return out;
  }

  async removeXtreamBlock(ip: string): Promise<void> {
    await this.redis.del(`xbrute:block:${ip}`).catch(() => {});
    await this.redis.del(`xbrute:fail:${ip}`).catch(() => {});
    await this.redis.del(`scan:invalid:${ip}`).catch(() => {});
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

  /** Engellenen baglanti denemeleri — anti-abuse gorunurlugu. */
  async listBlockedAttempts(params: { category?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Math.min(Number(params.limit), 200) : 50;
    const where = params.category ? { category: params.category } : {};
    const since = new Date(Date.now() - 24 * 3_600_000);
    const [items, total, last24h, byCat] = await Promise.all([
      this.prisma.blockedAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.blockedAttempt.count({ where }),
      this.prisma.blockedAttempt.count({ where: { createdAt: { gte: since } } }),
      this.prisma.blockedAttempt.groupBy({ by: ['category'], _count: { _all: true } }),
    ]);
    const categories = Object.fromEntries(byCat.map((c) => [c.category, c._count._all]));
    return { items, total, page, limit, last24h, categories };
  }

  // ── Otomatik ban (tekrarlayan ihlalciler) ─────────────────────────────
  async getAutoBanConfig() {
    const s = await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
      select: { autoBanEnabled: true, autoBanThreshold: true, autoBanWindowMins: true, autoBanDurationMins: true },
    });
    return {
      enabled: s.autoBanEnabled,
      threshold: s.autoBanThreshold,
      windowMins: s.autoBanWindowMins,
      durationMins: s.autoBanDurationMins,
    };
  }

  async updateAutoBanConfig(dto: { enabled?: boolean; threshold?: number; windowMins?: number; durationMins?: number }) {
    const data: {
      autoBanEnabled?: boolean;
      autoBanThreshold?: number;
      autoBanWindowMins?: number;
      autoBanDurationMins?: number;
    } = {};
    if (dto.enabled !== undefined) data.autoBanEnabled = Boolean(dto.enabled);
    if (dto.threshold !== undefined) data.autoBanThreshold = Math.max(1, Math.floor(Number(dto.threshold)));
    if (dto.windowMins !== undefined) data.autoBanWindowMins = Math.max(1, Math.floor(Number(dto.windowMins)));
    if (dto.durationMins !== undefined) data.autoBanDurationMins = Math.max(1, Math.floor(Number(dto.durationMins)));
    await this.prisma.settings.update({ where: { id: 'singleton' }, data });
    return this.getAutoBanConfig();
  }

  /** blocked_attempts'i tarar; pencere icinde esigi asan IP'leri (henuz banli degilse) banlar. */
  async runAutoBan(): Promise<{ scanned: number; banned: number; ips: string[] }> {
    const cfg = await this.getAutoBanConfig();
    const since = new Date(Date.now() - cfg.windowMins * 60_000);
    const groups = await this.prisma.blockedAttempt.groupBy({
      by: ['ip'],
      where: { ip: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const offenders = groups.filter((g) => g.ip && g._count._all >= cfg.threshold);
    const bannedIps: string[] = [];
    for (const g of offenders) {
      const ip = g.ip as string;
      if (await this.isIpBanned(ip)) continue;
      await this.banIp(ip, `Auto-ban: ${g._count._all} engellenen deneme (${cfg.windowMins}dk)`, cfg.durationMins, 'auto').catch(() => {});
      bannedIps.push(ip);
    }
    return { scanned: groups.length, banned: bannedIps.length, ips: bannedIps };
  }

  @Cron('*/10 * * * *')
  async autoBanScheduled(): Promise<void> {
    try {
      const cfg = await this.getAutoBanConfig();
      if (!cfg.enabled) return;
      const r = await this.runAutoBan();
      if (r.banned > 0) this.logger.log(`Auto-ban: ${r.banned} IP banlandi (${r.ips.join(', ')})`);
    } catch (err) {
      this.logger.error(`autoBanScheduled: ${(err as Error).message}`);
    }
  }
}
