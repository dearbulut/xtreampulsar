import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const CACHE_KEY = 'license:status';
const GRACE_KEY = 'license:grace';
const CACHE_TTL_SECONDS = 25 * 3600;

export interface LicenseStatus {
  valid: boolean;
  gracePeriod: boolean;
  tier: string | null;
  expiresAt: string | null;
  gracePeriodEnds: string | null;
  features: string[];
  checkedAt: string;
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getStatus(): Promise<LicenseStatus | null> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as LicenseStatus;
      } catch {
        // corrupted cache — fall through to re-fetch
      }
    }
    return this.verifyLicense();
  }

  async verifyLicense(): Promise<LicenseStatus | null> {
    const licenseServerUrl = this.config.get<string>('licenseServer.url');
    const licenseKey = this.config.get<string>('LICENSE_KEY');
    const serverUrl = this.config.get<string>('server.url') ?? '';

    if (!licenseKey) {
      this.logger.warn('LICENSE_KEY not configured');
      return null;
    }

    let serverIp: string;
    try {
      const url = new URL(serverUrl);
      serverIp = url.hostname;
    } catch {
      serverIp = serverUrl;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<LicenseStatus>(`${licenseServerUrl}/licenses/verify`, {
          key: licenseKey,
          serverIp,
          version: process.env.npm_package_version ?? '1.0.0',
        }),
      );

      const status: LicenseStatus = {
        ...response.data,
        checkedAt: new Date().toISOString(),
      };

      await this.redis.set(CACHE_KEY, JSON.stringify(status), 'EX', CACHE_TTL_SECONDS);

      if (!status.valid) {
        await this.redis.set(GRACE_KEY, status.gracePeriodEnds ?? '', 'EX', CACHE_TTL_SECONDS);
      } else {
        await this.redis.del(GRACE_KEY);
      }

      this.logger.log(`License verified: valid=${status.valid} tier=${status.tier}`);
      return status;
    } catch (err) {
      this.logger.error('License verification failed', err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async isValid(): Promise<boolean> {
    const status = await this.getStatus();
    return status?.valid ?? false;
  }

  async isInGrace(): Promise<boolean> {
    const grace = await this.redis.get(GRACE_KEY);
    if (!grace) return false;
    return new Date(grace) > new Date();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledVerification() {
    this.logger.log('Running scheduled license verification...');
    await this.redis.del(CACHE_KEY);
    await this.verifyLicense();
  }
}
