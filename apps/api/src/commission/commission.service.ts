import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async rate(): Promise<number> {
    const s = await this.prisma.settings
      .findUnique({ where: { id: 'singleton' }, select: { commissionRate: true } })
      .catch(() => null);
    return s?.commissionRate ?? 0;
  }

  async getRate() {
    return { rate: await this.rate() };
  }

  async setRate(r: number) {
    const rate = Math.max(0, Math.min(100, Math.floor(Number(r))));
    await this.prisma.settings.update({ where: { id: 'singleton' }, data: { commissionRate: rate } });
    return { rate };
  }

  /** Referans edilen bir bayi kredi alınca referans verene komisyon tahakkuk ettir (fire-and-forget). */
  accrue(sourceResellerId: string, creditAmount: number): void {
    void (async () => {
      try {
        const rate = await this.rate();
        if (rate <= 0 || creditAmount <= 0) return;
        const src = await this.prisma.reseller.findUnique({
          where: { id: sourceResellerId },
          select: { referredById: true, username: true },
        });
        if (!src?.referredById) return;
        const amount = Math.floor((creditAmount * rate) / 100);
        if (amount <= 0) return;
        await this.prisma.resellerCommission.create({
          data: { resellerId: src.referredById, sourceResellerId, amount, note: `${src.username} +${creditAmount} kredi (%${rate})` },
        });
        this.logger.log(`Commission accrued: ${amount} → ${src.referredById}`);
      } catch (err) {
        this.logger.error(`accrue: ${(err as Error).message}`);
      }
    })();
  }

  async list(params: { status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 50;
    const where = params.status ? { status: params.status } : {};
    const [rows, total, pendingAgg, paidAgg] = await Promise.all([
      this.prisma.resellerCommission.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.resellerCommission.count({ where }),
      this.prisma.resellerCommission.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.resellerCommission.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ]);
    const idSet = new Set<string>();
    for (const r of rows) {
      if (r.resellerId) idSet.add(r.resellerId);
      if (r.sourceResellerId) idSet.add(r.sourceResellerId);
    }
    const ids: string[] = [...idSet];
    const resellers = ids.length
      ? await this.prisma.reseller.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })
      : [];
    const nameMap = new Map(resellers.map((r) => [r.id, r.username]));
    const items = rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
      paidAt: r.paidAt,
      earner: nameMap.get(r.resellerId) ?? '—',
      source: r.sourceResellerId ? nameMap.get(r.sourceResellerId) ?? '—' : null,
    }));
    return { items, total, page, limit, pendingTotal: pendingAgg._sum.amount ?? 0, paidTotal: paidAgg._sum.amount ?? 0 };
  }

  /** Komisyonu öde: kazanan bayiye kredi ekle + kredi logu + PAID işaretle. */
  async markPaid(id: string) {
    const c = await this.prisma.resellerCommission.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Komisyon bulunamadı');
    if (c.status === 'PAID') return c;
    const reseller = await this.prisma.reseller.findUnique({ where: { id: c.resellerId }, select: { credits: true } });
    if (!reseller) {
      return this.prisma.resellerCommission.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.resellerCommission.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } }),
      this.prisma.reseller.update({ where: { id: c.resellerId }, data: { credits: { increment: c.amount } } }),
      this.prisma.resellerCreditLog.create({
        data: { resellerId: c.resellerId, amount: c.amount, type: 'ADD', reason: 'Affiliate komisyonu', balanceAfter: reseller.credits + c.amount },
      }),
    ]);
    return updated;
  }

  async remove(id: string) {
    const c = await this.prisma.resellerCommission.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Komisyon bulunamadı');
    if (c.status === 'PAID') throw new BadRequestException('Ödenmiş komisyon silinemez');
    await this.prisma.resellerCommission.delete({ where: { id } });
    return { success: true };
  }

  private async ensureReferralCode(resellerId: string): Promise<string> {
    const r = await this.prisma.reseller.findUnique({ where: { id: resellerId }, select: { referralCode: true } });
    if (r?.referralCode) return r.referralCode;
    for (let i = 0; i < 6; i++) {
      const code = `REF${crypto.randomInt(100000, 1000000)}`;
      const exists = await this.prisma.reseller.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!exists) {
        await this.prisma.reseller.update({ where: { id: resellerId }, data: { referralCode: code } }).catch(() => {});
        return code;
      }
    }
    return `REF${resellerId.slice(-6)}`;
  }

  /** Bayi paneli: referans kodum + referans ettiğim bayiler + komisyon özetim. */
  async myReferral(resellerId: string) {
    const code = await this.ensureReferralCode(resellerId);
    const [referrals, pending, paid] = await Promise.all([
      this.prisma.reseller.count({ where: { referredById: resellerId, deletedAt: null } }),
      this.prisma.resellerCommission.aggregate({ where: { resellerId, status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.resellerCommission.aggregate({ where: { resellerId, status: 'PAID' }, _sum: { amount: true } }),
    ]);
    return { referralCode: code, referrals, pendingCredits: pending._sum.amount ?? 0, paidCredits: paid._sum.amount ?? 0 };
  }

  /** Admin: bir bayiye referans veren bayiyi (referral kodu ile) ata. */
  async setReferrer(resellerId: string, code: string) {
    const clean = (code ?? '').trim();
    if (!clean) throw new BadRequestException('Referans kodu gerekli');
    const referrer = await this.prisma.reseller.findUnique({ where: { referralCode: clean }, select: { id: true } });
    if (!referrer) throw new NotFoundException('Referans kodu bulunamadı');
    if (referrer.id === resellerId) throw new BadRequestException('Bayi kendini referans edemez');
    await this.prisma.reseller.update({ where: { id: resellerId }, data: { referredById: referrer.id } });
    return { success: true };
  }
}
