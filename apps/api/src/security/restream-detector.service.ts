import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { SecurityService } from './security.service';
import type { EffectiveGuard } from '../server/guard-config.service';

const RS_WINDOW = parseInt(process.env.RS_WINDOW ?? '300', 10); // sn

@Injectable()
export class RestreamDetectorService {
  private readonly logger = new Logger(RestreamDetectorService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly security: SecurityService,
  ) {}

  // Fire-and-forget: oynatmayı ASLA bloklamaz. Enforce'ta ban ayrı istekte devreye girer.
  async record(p: {
    userId: string;
    username: string;
    ip: string;
    maxConnections: number;
    guard: EffectiveGuard;
  }): Promise<void> {
    if (!p.guard.enabled || !p.ip) return;

    let uHits = 0;
    let ipHits = 0;
    let distinctIps = 0;
    try {
      uHits = await this.redis.incr(`rs:u:hits:${p.userId}`).catch(() => 0);
      if (uHits === 1) await this.redis.expire(`rs:u:hits:${p.userId}`, RS_WINDOW).catch(() => {});

      ipHits = await this.redis.incr(`rs:ip:hits:${p.ip}`).catch(() => 0);
      if (ipHits === 1) await this.redis.expire(`rs:ip:hits:${p.ip}`, RS_WINDOW).catch(() => {});

      const added = await this.redis.sadd(`rs:u:ips:${p.userId}`, p.ip).catch(() => 0);
      if (added === 1) await this.redis.expire(`rs:u:ips:${p.userId}`, RS_WINDOW).catch(() => {});
      distinctIps = await this.redis.scard(`rs:u:ips:${p.userId}`).catch(() => 0);
    } catch {
      /* Redis non-fatal — tespit best-effort */
      return;
    }

    const fanOutLimit = Math.max(4, p.maxConnections * 2);
    const restreamer = distinctIps > fanOutLimit;
    const ipRateHit = p.guard.maxHitsRestreamer > 0 && ipHits > p.guard.maxHitsRestreamer;
    const userRateHit = p.guard.maxHitsNormalUser > 0 && uHits > p.guard.maxHitsNormalUser;

    const enforce = process.env.GUARD_RESTREAM_ENFORCE === 'true';
    if (restreamer || ipRateHit) {
      const reason = restreamer
        ? `restreamer: ${distinctIps} IP (limit ${fanOutLimit}) user=${p.username}`
        : `hit-rate: ${ipHits} hits/${RS_WINDOW}s ip=${p.ip}`;
      this.logger.warn(`[restream] ${enforce ? 'BLOCK' : 'report-only'} → ${reason}`);
      if (enforce) await this.security.banIp(p.ip, reason, p.guard.blockDurationMinutes).catch(() => {});
    } else if (userRateHit) {
      this.logger.warn(`[restream] soft: user hit-rate ${uHits}/${RS_WINDOW}s user=${p.username} (blok yok)`);
    }
  }
}
