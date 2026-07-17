import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { VerifyLicenseDto } from './dto/verify-license.dto';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { ExtendLicenseDto } from './dto/extend-license.dto';

const GRACE_PERIOD_HOURS = 48;

const TIER_FEATURES: Record<string, string[]> = {
  STARTER: ['500_users', '2_servers', 'basic_analytics'],
  PRO: ['5000_users', '10_servers', 'advanced_analytics', 'epg', 'reseller'],
  BUSINESS: ['unlimited_users', 'unlimited_servers', 'full_analytics', 'epg', 'reseller', 'white_label'],
  WHITE_LABEL: ['unlimited_users', 'unlimited_servers', 'full_analytics', 'epg', 'reseller', 'white_label', 'custom_branding'],
};

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.license.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        key: true,
        serverIp: true,
        tier: true,
        status: true,
        expiresAt: true,
        lastVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByKey(key: string) {
    const license = await this.prisma.license.findUnique({ where: { key } });
    if (!license) throw new NotFoundException(`License key ${key} not found`);
    return license;
  }

  async create(dto: CreateLicenseDto) {
    const existing = await this.prisma.license.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`License key ${dto.key} already exists`);

    return this.prisma.license.create({
      data: {
        key: dto.key,
        tier: dto.tier,
        expiresAt: new Date(dto.expiresAt),
        serverIp: dto.serverIp ?? null,
        status: 'PENDING',
      },
    });
  }

  async activate(dto: ActivateLicenseDto) {
    const license = await this.findByKey(dto.key);

    if (license.status === 'SUSPENDED') {
      throw new BadRequestException('License is suspended');
    }
    if (license.status === 'EXPIRED') {
      throw new BadRequestException('License is expired');
    }
    if (license.serverIp && license.serverIp !== dto.serverIp) {
      throw new ConflictException(
        `License is already bound to ${license.serverIp}`,
      );
    }

    return this.prisma.license.update({
      where: { key: dto.key },
      data: { serverIp: dto.serverIp, status: 'ACTIVE' },
    });
  }

  async verify(dto: VerifyLicenseDto) {
    const now = new Date();
    let isValid = false;
    let reason: string | undefined;
    let gracePeriod = false;

    const license = await this.prisma.license.findUnique({
      where: { key: dto.key },
    });

    if (!license) {
      reason = 'License key not found';
    } else if (license.status === 'SUSPENDED') {
      reason = 'License is suspended';
    } else if (license.status === 'PENDING') {
      reason = 'License not yet activated';
    } else if (license.serverIp && license.serverIp !== dto.serverIp) {
      reason = `Server IP mismatch (expected ${license.serverIp})`;
    } else {
      const gracePeriodEnds = new Date(license.expiresAt);
      gracePeriodEnds.setHours(gracePeriodEnds.getHours() + GRACE_PERIOD_HOURS);

      if (now <= license.expiresAt) {
        isValid = true;
      } else if (now <= gracePeriodEnds) {
        isValid = true;
        gracePeriod = true;
        reason = 'Grace period active';
      } else {
        reason = 'License expired';
        await this.prisma.license.update({
          where: { key: dto.key },
          data: { status: 'EXPIRED' },
        });
      }
    }

    if (license && isValid) {
      await this.prisma.license.update({
        where: { key: dto.key },
        data: { lastVerifiedAt: now },
      });
    }

    await this.prisma.licenseVerificationLog.create({
      data: {
        licenseKey: dto.key,
        serverIp: dto.serverIp,
        version: dto.version,
        isValid,
        reason: reason ?? null,
      },
    });

    this.logger.log(
      `Verify: key=${dto.key} ip=${dto.serverIp} valid=${isValid} reason=${reason ?? 'ok'}`,
    );

    const gracePeriodEnds = license
      ? new Date(new Date(license.expiresAt).getTime() + GRACE_PERIOD_HOURS * 3_600_000).toISOString()
      : null;

    return {
      valid: isValid,
      gracePeriod,
      tier: license?.tier ?? null,
      expiresAt: license?.expiresAt?.toISOString() ?? null,
      gracePeriodEnds,
      features: isValid && license ? (TIER_FEATURES[license.tier] ?? []) : [],
      reason: reason ?? null,
    };
  }

  async suspend(key: string) {
    await this.findByKey(key);
    return this.prisma.license.update({
      where: { key },
      data: { status: 'SUSPENDED' },
    });
  }

  async reactivate(key: string) {
    const license = await this.findByKey(key);
    if (license.status === 'ACTIVE') return license; // idempotent
    // Esas kullanım: SUSPENDED → ACTIVE. EXPIRED + geçmiş expiresAt için tek
    // başına yetmez (status ACTIVE olsa da süre geçmiş kalır) — o durumda extend kullanılır.
    return this.prisma.license.update({
      where: { key },
      data: { status: 'ACTIVE' },
    });
  }

  async revoke(key: string) {
    await this.findByKey(key);
    return this.prisma.license.update({
      where: { key },
      data: { status: 'EXPIRED' },
    });
  }

  async extend(key: string, dto: ExtendLicenseDto) {
    const license = await this.findByKey(key);
    const base = license.expiresAt > new Date() ? license.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + dto.days * 86_400_000);

    return this.prisma.license.update({
      where: { key },
      data: {
        expiresAt: newExpiry,
        status: license.status === 'EXPIRED' ? 'ACTIVE' : license.status,
      },
    });
  }

  async getLogs(key: string, limit = 50) {
    await this.findByKey(key);
    return this.prisma.licenseVerificationLog.findMany({
      where: { licenseKey: key },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
