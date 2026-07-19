import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResellerApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(resellerId: string, name: string) {
    const key = `rsk_live_${crypto.randomBytes(20).toString('hex')}`;
    const rec = await this.prisma.resellerApiKey.create({
      data: { resellerId, name: name?.trim() || 'API Key', key },
    });
    return { ...rec, key };
  }

  async list(resellerId: string) {
    const keys = await this.prisma.resellerApiKey.findMany({
      where: { resellerId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({ ...k, key: `${k.key.slice(0, 16)}…${k.key.slice(-4)}` }));
  }

  async revoke(resellerId: string, id: string) {
    const k = await this.prisma.resellerApiKey.findUnique({ where: { id } });
    if (!k || k.resellerId !== resellerId) throw new NotFoundException('API key not found');
    await this.prisma.resellerApiKey.delete({ where: { id } });
    return { deleted: true };
  }

  async validate(rawKey: string): Promise<{ resellerId: string } | null> {
    const k = await this.prisma.resellerApiKey.findUnique({
      where: { key: rawKey },
      include: { reseller: { select: { isActive: true, deletedAt: true } } },
    });
    if (!k || !k.isActive) return null;
    if (k.expiresAt && k.expiresAt < new Date()) return null;
    if (!k.reseller || !k.reseller.isActive || k.reseller.deletedAt) return null;
    void this.prisma.resellerApiKey.update({ where: { id: k.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return { resellerId: k.resellerId };
  }
}
