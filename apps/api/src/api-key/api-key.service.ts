import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string, permissions: string[], expiresAt?: Date) {
    const rawKey = `xp_live_${crypto.randomBytes(16).toString('hex')}`;

    const apiKey = await this.prisma.apiKey.create({
      data: { userId, name, key: rawKey, permissions, expiresAt },
    });

    return { ...apiKey, key: rawKey };
  }

  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      ...k,
      key: `${k.key.slice(0, 12)}...${k.key.slice(-4)}`,
    }));
  }

  async delete(id: string, userId: string): Promise<void> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException('Not your key');
    await this.prisma.apiKey.delete({ where: { id } });
  }

  async validateKey(rawKey: string): Promise<{ userId: string; permissions: string[] } | null> {
    const key = await this.prisma.apiKey.findUnique({ where: { key: rawKey } });
    if (!key || !key.isActive) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { userId: key.userId, permissions: key.permissions };
  }
}
