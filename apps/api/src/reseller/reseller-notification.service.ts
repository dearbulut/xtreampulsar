import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType = 'LOW_CREDIT' | 'USER_EXPIRING';

const LOW_CREDIT_THRESHOLD = 5;

@Injectable()
export class ResellerNotificationService {
  private readonly logger = new Logger(ResellerNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Cron job ─────────────────────────────────────────────────────────────

  @Cron('0 * * * *')
  async checkLowCreditAndExpiring(): Promise<void> {
    this.logger.log('Running reseller notification check…');

    const resellers = await this.prisma.reseller.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, credits: true },
    });

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);
    const oneDayAgo = new Date(now.getTime() - 24 * 3_600_000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = await Promise.allSettled(
      resellers.map((reseller) => this.checkOneReseller(reseller, now, in7Days, oneDayAgo, todayStart)),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) this.logger.warn(`${failed} reseller notification checks failed`);
    this.logger.log(`Notification check done — ${resellers.length} resellers processed`);
  }

  private async checkOneReseller(
    reseller: { id: string; credits: number },
    now: Date,
    in7Days: Date,
    oneDayAgo: Date,
    todayStart: Date,
  ): Promise<void> {
    // LOW_CREDIT: at most once per 24 h
    if (reseller.credits < LOW_CREDIT_THRESHOLD) {
      const existing = await this.prisma.resellerNotification.findFirst({
        where: { resellerId: reseller.id, type: 'LOW_CREDIT', createdAt: { gte: oneDayAgo } },
      });
      if (!existing) {
        await this.prisma.resellerNotification.create({
          data: {
            resellerId: reseller.id,
            type: 'LOW_CREDIT',
            title: 'Krediniz Azalıyor',
            message: `Bakiyeniz ${reseller.credits} krediye düştü. Hizmet kesintisi yaşamamak için lütfen kredi yükleyin.`,
          },
        });
      }
    }

    // USER_EXPIRING: at most once per calendar day
    const expiringUsers = await this.prisma.user.findMany({
      where: {
        resellerId: reseller.id,
        deletedAt: null,
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: in7Days },
      },
      select: { id: true, username: true, expiresAt: true },
    });

    if (expiringUsers.length > 0) {
      const existingToday = await this.prisma.resellerNotification.findFirst({
        where: { resellerId: reseller.id, type: 'USER_EXPIRING', createdAt: { gte: todayStart } },
      });
      if (!existingToday) {
        await this.prisma.resellerNotification.create({
          data: {
            resellerId: reseller.id,
            type: 'USER_EXPIRING',
            title: `${expiringUsers.length} Kullanıcının Süresi Dolmak Üzere`,
            message: `${expiringUsers.length} kullanıcının aboneliği 7 gün içinde sona eriyor.`,
            metadata: {
              count: expiringUsers.length,
              users: expiringUsers.map((u) => ({
                id: u.id,
                username: u.username,
                expiresAt: u.expiresAt.toISOString(),
                daysLeft: Math.ceil((u.expiresAt.getTime() - now.getTime()) / 86_400_000),
              })),
            },
          },
        });
      }
    }
  }

  // ─── Query methods ────────────────────────────────────────────────────────

  async getNotifications(resellerId: string, unreadOnly = false) {
    return this.prisma.resellerNotification.findMany({
      where: {
        resellerId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(resellerId: string): Promise<number> {
    return this.prisma.resellerNotification.count({
      where: { resellerId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, resellerId: string): Promise<void> {
    const n = await this.prisma.resellerNotification.findFirst({
      where: { id: notificationId, resellerId },
    });
    if (!n) throw new NotFoundException('Bildirim bulunamadı');
    await this.prisma.resellerNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(resellerId: string): Promise<void> {
    await this.prisma.resellerNotification.updateMany({
      where: { resellerId, isRead: false },
      data: { isRead: true },
    });
  }
}
