import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EffectiveGuard {
  enabled: boolean;              // guard yoksa false
  serverId: string | null;
  maxConnsPerIp: number;         // enabled ? guard.maxConnsPerIp : (env MAX_CONNECTIONS_PER_IP ?? 0)
  denyInvalidStreamIds: boolean; // enabled ? guard.denyInvalidStreamIds : true
  blockDurationMinutes: number;  // enabled ? guard.blockDurationMinutes : 30
  whitelistIps: string[];        // enabled ? guard.whitelistIps : []
  whitelistUsernames: string[];  // enabled ? guard.whitelistUsernames : []
  maxHitsNormalUser: number;     // (Aşama 2 için taşınıyor; şimdilik sadece döndür)
  maxHitsRestreamer: number;
}

const CACHE_TTL_MS = 10_000; // 10s — her stream isteğinde DB'ye gitme

@Injectable()
export class GuardConfigService {
  private cache: { value: EffectiveGuard; expires: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getEffective(): Promise<EffectiveGuard> {
    const now = Date.now();
    if (this.cache && this.cache.expires > now) {
      return this.cache.value;
    }

    const value = await this.resolve();
    this.cache = { value, expires: now + CACHE_TTL_MS };
    return value;
  }

  private envMaxConnsPerIp(): number {
    return parseInt(process.env.MAX_CONNECTIONS_PER_IP ?? '0', 10) || 0;
  }

  private disabled(serverId: string | null): EffectiveGuard {
    // Guard yok / enabled=false → mevcut env davranışı birebir korunur.
    return {
      enabled: false,
      serverId,
      maxConnsPerIp: this.envMaxConnsPerIp(),
      denyInvalidStreamIds: true,
      blockDurationMinutes: 30,
      whitelistIps: [],
      whitelistUsernames: [],
      maxHitsNormalUser: 0,
      maxHitsRestreamer: 0,
    };
  }

  private async resolve(): Promise<EffectiveGuard> {
    // Ana sunucuyu bul: role MAIN, yoksa en eski kayıt.
    const server =
      (await this.prisma.server.findFirst({ where: { role: 'MAIN' } })) ??
      (await this.prisma.server.findFirst({ orderBy: { createdAt: 'asc' } }));

    if (!server) return this.disabled(null);

    const guard = await this.prisma.serverGuard.findUnique({ where: { serverId: server.id } });

    if (!guard || !guard.enabled) return this.disabled(server.id);

    return {
      enabled: true,
      serverId: server.id,
      maxConnsPerIp: guard.maxConnsPerIp,
      denyInvalidStreamIds: guard.denyInvalidStreamIds,
      blockDurationMinutes: guard.blockDurationMinutes,
      whitelistIps: guard.whitelistIps,
      whitelistUsernames: guard.whitelistUsernames,
      maxHitsNormalUser: guard.maxHitsNormalUser,
      maxHitsRestreamer: guard.maxHitsRestreamer,
    };
  }
}
