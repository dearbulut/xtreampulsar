import { Injectable, Logger, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

interface WhiteLabelConfig {
  id: string;
  panelName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customCss: string | null;
  footerText: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
  isActive: boolean;
  licenseKey: string;
}

interface UpdateWhiteLabelDto {
  panelName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
  customCss?: string;
  footerText?: string;
  supportEmail?: string;
  supportUrl?: string;
  isActive?: boolean;
}

const CACHE_KEY = 'white-label:config';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class WhiteLabelService {
  private readonly logger = new Logger(WhiteLabelService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getConfig(): Promise<WhiteLabelConfig | null> {
    const cached = await this.redis.get(CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached) as WhiteLabelConfig;

    const config = await this.prisma.whiteLabel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (config) {
      await this.redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(config)).catch(() => {});
    }

    return config;
  }

  async updateConfig(dto: UpdateWhiteLabelDto): Promise<WhiteLabelConfig> {
    const existing = await this.prisma.whiteLabel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    let result: WhiteLabelConfig;
    if (existing) {
      result = await this.prisma.whiteLabel.update({
        where: { id: existing.id },
        data: dto,
      });
    } else {
      result = await this.prisma.whiteLabel.create({
        data: {
          panelName: dto.panelName ?? 'XtreamPulsar',
          licenseKey: `wl_${Date.now()}`,
          ...dto,
        },
      });
    }

    await this.redis.del(CACHE_KEY).catch(() => {});
    return result;
  }

  async setLogoUrl(logoUrl: string): Promise<WhiteLabelConfig> {
    return this.updateConfig({ logoUrl });
  }

  async getPreview(): Promise<{
    config: WhiteLabelConfig | null;
    cssVars: Record<string, string>;
  }> {
    const config = await this.getConfig();
    const cssVars: Record<string, string> = {};
    if (config) {
      cssVars['--color-primary'] = config.primaryColor;
      cssVars['--color-secondary'] = config.secondaryColor;
    }
    return { config, cssVars };
  }
}
