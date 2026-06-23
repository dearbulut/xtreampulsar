import { Injectable } from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityQueryDto } from './dto/activity-query.dto';

@Injectable()
export class UserActivityService {
  constructor(private readonly prisma: PrismaService) {}

  detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tv' | 'unknown' {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();
    if (/smart.?tv|smarttv|appletv|googletv|firetv|fire tv|roku|webos|tizen|netcast|viera|bravia|aquos|tvos/i.test(ua)) return 'tv';
    if (/mobile|android(?!.*tablet)|iphone|ipod|blackberry|windows phone|opera mini|opera mobi/i.test(ua)) return 'mobile';
    if (/windows|macintosh|linux|x11|cros/i.test(ua)) return 'desktop';
    return 'unknown';
  }

  async logActivity(data: {
    userId: string;
    action: string;
    streamId?: string;
    ip?: string;
    userAgent?: string;
    country?: string;
    deviceType?: string;
    duration?: number;
    bytesTransferred?: bigint;
    endedAt?: Date;
  }): Promise<void> {
    try {
      const deviceType =
        data.deviceType ??
        (data.userAgent ? this.detectDeviceType(data.userAgent) : 'unknown');
      await this.prisma.userActivityLog.create({
        data: { ...data, deviceType },
      });
    } catch { /* non-fatal */ }
  }

  async getActivityByUser(userId: string, query: ActivityQueryDto) {
    const page  = query.page  ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip  = (page - 1) * limit;

    const where: Prisma.UserActivityLogWhereInput = {
      userId,
      ...(query.action ? { action: query.action } : {}),
      ...((query.startDate || query.endDate) ? {
        createdAt: {
          ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
          ...(query.endDate   ? { lte: new Date(query.endDate)   } : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userActivityLog.count({ where }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getUserStats(userId: string) {
    const [durationAgg, bytesAgg, lastActivity, deviceBreakdown, actionBreakdown] =
      await Promise.all([
        this.prisma.userActivityLog.aggregate({
          where: { userId, duration: { not: null } },
          _sum: { duration: true },
        }),
        this.prisma.userActivityLog.aggregate({
          where: { userId, bytesTransferred: { not: null } },
          _sum: { bytesTransferred: true },
        }),
        this.prisma.userActivityLog.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, action: true, streamId: true, country: true, deviceType: true },
        }),
        this.prisma.userActivityLog.groupBy({
          by: ['deviceType'],
          where: { userId, deviceType: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { deviceType: 'desc' } },
        }),
        this.prisma.userActivityLog.groupBy({
          by: ['action'],
          where: { userId },
          _count: { _all: true },
          orderBy: { _count: { action: 'desc' } },
        }),
      ]);

    return {
      totalDurationSeconds: durationAgg._sum.duration ?? 0,
      totalBytesTransferred: (bytesAgg._sum.bytesTransferred ?? BigInt(0)).toString(),
      lastActivity,
      deviceBreakdown: Object.fromEntries(
        deviceBreakdown
          .filter((d) => d.deviceType)
          .map((d) => [d.deviceType as string, d._count._all]),
      ),
      actionBreakdown: Object.fromEntries(
        actionBreakdown.map((a) => [a.action, a._count._all]),
      ),
    };
  }
}
