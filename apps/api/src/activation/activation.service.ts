import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Karışıklık yaratan karakterleri (0/O/1/I) hariç tutan okunaklı kod üretir: XP-XXXX-XXXX-XXXX. */
  private genCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const group = () =>
      Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
    return `XP-${group()}-${group()}-${group()}`;
  }

  async generate(count: number, durationDays: number, maxConnections?: number, note?: string) {
    const n = Math.min(Math.max(count || 1, 1), 500);
    if (!durationDays || durationDays < 1) throw new BadRequestException('durationDays geçersiz');
    const codes: string[] = [];
    for (let i = 0; i < n; i++) codes.push(this.genCode());
    await this.prisma.activationCode.createMany({
      data: codes.map((code) => ({ code, durationDays, maxConnections: maxConnections ?? null, note: note ?? null })),
      skipDuplicates: true,
    });
    return { generated: codes.length, codes };
  }

  async list(params: { status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 100;
    const where = params.status ? { status: params.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.activationCode.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.activationCode.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async disable(id: string) {
    const code = await this.prisma.activationCode.findUnique({ where: { id } });
    if (!code) throw new NotFoundException('Kod bulunamadı');
    if (code.status === 'USED') throw new BadRequestException('Kullanılmış kod devre dışı bırakılamaz');
    return this.prisma.activationCode.update({ where: { id }, data: { status: 'DISABLED' } });
  }

  /** Aboneyi bu kodla uzatır: expiry = max(now, mevcut) + durationDays. Kod USED olur. */
  async redeem(rawCode: string, userId: string) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Kod boş');
    const rec = await this.prisma.activationCode.findUnique({ where: { code } });
    if (!rec) throw new NotFoundException('Geçersiz kod');
    if (rec.status !== 'ACTIVE') throw new BadRequestException('Bu kod zaten kullanılmış veya devre dışı');

    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const now = new Date();
    const base = user.expiresAt && user.expiresAt > now ? user.expiresAt : now;
    const newExpiry = new Date(base.getTime() + rec.durationDays * 86_400_000);

    const result = await this.prisma.$transaction(async (tx) => {
      // Yarış koşulunu önle: kodu ancak hâlâ ACTIVE ise USED yap
      const claim = await tx.activationCode.updateMany({
        where: { id: rec.id, status: 'ACTIVE' },
        data: { status: 'USED', usedByUserId: user.id, usedByUsername: user.username, usedAt: now },
      });
      if (claim.count === 0) throw new BadRequestException('Bu kod az önce kullanıldı');
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          expiresAt: newExpiry,
          status: 'ACTIVE',
          isTrial: false,
          trialEndsAt: null,
          ...(rec.maxConnections ? { maxConnections: rec.maxConnections } : {}),
        },
        select: { expiresAt: true, maxConnections: true },
      });
      return updated;
    });

    this.logger.log(`Activation: ${user.username} redeemed ${code} (+${rec.durationDays}d)`);
    return { success: true, durationDays: rec.durationDays, expiresAt: result.expiresAt, maxConnections: result.maxConnections };
  }
}
