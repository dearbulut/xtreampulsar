import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from './security.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const SETTINGS_CACHE_KEY = 'geoblock:panel:settings';
const SETTINGS_TTL_SEC = 300; // 5 min

// Paths that bypass panel geo-block (Xtream / public)
const BYPASS_RE = [
  /^\/player_api\.php/,
  /^\/get\.php/,
  /^\/panel_api\.php/,
  /^\/xmltv\.php/,
  /^\/(live|movie|series)\//,
  /^\/hls\//,
  /^\/stalker\//,
  /^\/playlist\//,
  /^\/health/,
  /^\/uploads\//,
];

const PRIVATE_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1']);

interface GeoBlockSettings {
  geoBlockEnabled: boolean;
  allowedCountries: string[];
}

@Injectable()
export class PanelGeoBlockGuard implements CanActivate {
  constructor(
    private readonly securityService: SecurityService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method === 'OPTIONS') return true;

    const path = request.path ?? '';
    if (BYPASS_RE.some((re) => re.test(path))) return true;

    const ip = this.extractIp(request);
    if (!ip || PRIVATE_IPS.has(ip)) return true;

    const settings = await this.getSettings();
    if (!settings.geoBlockEnabled || settings.allowedCountries.length === 0) return true;

    const ipInfo = await this.securityService.getIpInfo(ip);
    if (!settings.allowedCountries.includes(ipInfo.countryCode)) {
      throw new ForbiddenException('Bu konumdan panel erişimi engellendi');
    }

    return true;
  }

  private extractIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      request.socket?.remoteAddress ??
      ''
    );
  }

  private async getSettings(): Promise<GeoBlockSettings> {
    if (this.redis) {
      const cached = await this.redis.get(SETTINGS_CACHE_KEY).catch(() => null);
      if (cached) return JSON.parse(cached) as GeoBlockSettings;
    }

    const row = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { geoBlockEnabled: true, allowedCountries: true },
    });

    const result: GeoBlockSettings = {
      geoBlockEnabled: row?.geoBlockEnabled ?? false,
      allowedCountries: row?.allowedCountries ?? [],
    };

    if (this.redis) {
      await this.redis.setex(SETTINGS_CACHE_KEY, SETTINGS_TTL_SEC, JSON.stringify(result)).catch(() => {});
    }

    return result;
  }
}
