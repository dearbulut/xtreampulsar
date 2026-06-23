import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Xtream-facing (unchanged) ─────────────────────────────────────────────

  async findByCredentials(username: string, password: string) {
    const user = await this.userRepo.findByUsername(username);

    if (!user) {
      this.logger.debug(`[findByCredentials] user not found: "${username}"`);
      return null;
    }
    if (user.deletedAt) {
      this.logger.debug(`[findByCredentials] user "${username}" is soft-deleted (deletedAt=${user.deletedAt.toISOString()})`);
      return null;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      this.logger.debug(`[findByCredentials] password mismatch for "${username}" — hash prefix: ${user.password.slice(0, 7)}`);
      return null;
    }

    this.logger.debug(`[findByCredentials] OK: "${username}" id=${user.id} role=${user.role} status=${user.status}`);
    return user;
  }

  async findById(id: string) {
    return this.userRepo.findById(id);
  }

  async validateConnection(userId: string, ip: string, _userAgent?: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) return { allowed: false, reason: 'User not found' };
    if (user.status !== 'ACTIVE') {
      return { allowed: false, reason: `Account ${user.status.toLowerCase()}` };
    }
    // ADMIN and RESELLER roles are not bound by expiry or connection limits
    if (user.role === 'ADMIN' || user.role === 'RESELLER') {
      return { allowed: true };
    }
    // expiresAt may be null on legacy records; treat null as expired
    if (!user.expiresAt || user.expiresAt < new Date()) {
      return { allowed: false, reason: 'Account expired' };
    }
    const active = await this.userRepo.countActiveConnections(userId);
    if (active >= user.maxConnections) {
      return { allowed: false, reason: `Max connections reached (${user.maxConnections})` };
    }
    return { allowed: true };
  }

  async createConnection(userId: string, streamId: string, ip: string, userAgent?: string, serverId?: string, token?: string) {
    return this.userRepo.createConnection({ userId, streamId, ip, userAgent, serverId, token });
  }

  async closeConnection(connectionId: string): Promise<void> {
    return this.userRepo.closeConnection(connectionId);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 20, search, resellerId, status, expiring_soon } = query;
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where = {
      deletedAt: null,
      ...(search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { notes: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(resellerId ? { resellerId } : {}),
      ...(status ? { status: status as 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'BANNED' } : {}),
      ...(expiring_soon ? { expiresAt: { lte: sevenDays, gte: now } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, role: true, status: true,
          maxConnections: true, expiresAt: true, notes: true,
          createdAt: true, resellerId: true,
          _count: { select: { connections: { where: { endedAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) throw new ConflictException(`Username "${dto.username}" already taken`);

    const hashed = await bcrypt.hash(dto.password, 12);
    const { password: _, packageId, bouquetIds, ...rest } = dto;

    // Resolve package defaults (expiresAt, maxConnections)
    let resolvedExpiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    let resolvedMaxConnections = dto.maxConnections ?? 1;

    if (packageId) {
      const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
      if (pkg) {
        if (!dto.expiresAt) {
          const now = new Date();
          resolvedExpiresAt = new Date(now.getTime() + pkg.durationDays * 86_400_000);
        }
        if (!dto.maxConnections) {
          resolvedMaxConnections = pkg.maxConnections;
        }
        // Deduct credits from reseller if applicable
        if (dto.resellerId) {
          await this.prisma.reseller.update({
            where: { id: dto.resellerId },
            data: { credits: { decrement: pkg.creditCost } },
          }).catch(() => { /* non-fatal — reseller might not exist */ });
        }
      }
    }

    if (!resolvedExpiresAt) {
      // Default: 30 days if nothing provided
      const now = new Date();
      resolvedExpiresAt = new Date(now.getTime() + 30 * 86_400_000);
    }

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        expiresAt: resolvedExpiresAt,
        maxConnections: resolvedMaxConnections,
        role: (dto.role ?? 'USER') as 'ADMIN' | 'RESELLER' | 'USER',
        ...(packageId ? { packageId } : {}),
      },
      select: {
        id: true, username: true, role: true, status: true,
        maxConnections: true, expiresAt: true, createdAt: true, packageId: true,
      },
    });

    if (bouquetIds && bouquetIds.length > 0) {
      await this.prisma.userBouquet.createMany({
        data: bouquetIds.map((bouquetId) => ({ userId: user.id, bouquetId })),
        skipDuplicates: true,
      });
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.assertExists(id);

    const { bouquetIds, ...updateFields } = dto;
    const data: Record<string, unknown> = { ...updateFields };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
    }
    if (dto.expiresAt) {
      data.expiresAt = new Date(dto.expiresAt);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, username: true, role: true, status: true,
        maxConnections: true, expiresAt: true, updatedAt: true,
      },
    });

    if (bouquetIds !== undefined) {
      await this.prisma.userBouquet.deleteMany({ where: { userId: id } });
      if (bouquetIds.length > 0) {
        await this.prisma.userBouquet.createMany({
          data: bouquetIds.map((bouquetId) => ({ userId: id, bouquetId })),
          skipDuplicates: true,
        });
      }
    }

    return user;
  }

  async softDelete(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
  }

  async extend(id: string, days: number) {
    const user = await this.assertExists(id);
    const base = user.expiresAt > new Date() ? user.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    return this.prisma.user.update({
      where: { id },
      data: { expiresAt: newExpiry, status: 'ACTIVE' },
      select: { id: true, username: true, expiresAt: true },
    });
  }

  async ban(id: string) {
    await this.assertExists(id);
    await this.userRepo.closeAllUserConnections(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: 'BANNED' },
      select: { id: true, username: true, status: true },
    });
  }

  async unban(id: string) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: { id: true, username: true, status: true },
    });
  }

  async getActiveConnections(id: string) {
    await this.assertExists(id);
    return this.prisma.connection.findMany({
      where: { userId: id, endedAt: null },
      include: { stream: { select: { id: true, name: true, status: true } }, server: true },
      orderBy: { startedAt: 'desc' },
    });
  }

  async kickAll(id: string): Promise<{ kicked: number }> {
    await this.assertExists(id);
    const result = await this.userRepo.closeAllUserConnections(id);
    return { kicked: result.count };
  }

  async findExpiring(days = 7) {
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: threshold },
      },
      select: {
        id: true, username: true, expiresAt: true,
        resellerId: true, maxConnections: true,
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async bulkExtend(userIds: string[], days: number): Promise<{ updated: number }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, expiresAt: true },
    });

    await Promise.all(
      users.map((u) => {
        const base = u.expiresAt > new Date() ? u.expiresAt : new Date();
        return this.prisma.user.update({
          where: { id: u.id },
          data: { expiresAt: new Date(base.getTime() + days * 24 * 60 * 60 * 1000) },
        });
      }),
    );

    return { updated: users.length };
  }

  async bulkSoftDelete(userIds: string[]): Promise<{ deleted: number }> {
    const result = await this.prisma.user.updateMany({
      where: { id: { in: userIds }, deletedAt: null },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
    return { deleted: result.count };
  }

  async generateQrCode(id: string): Promise<{ qrCodeImage: string; serverUrl: string; username: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const baseUrl = settings?.serverUrl
      ? `${settings.serverUrl}:${settings.serverPort ?? 25461}`
      : `http://localhost:${settings?.serverPort ?? 25461}`;

    const payload = JSON.stringify({
      dns: baseUrl,
      username: user.username,
      password: '',
      type: 'm3u_plus',
    });

    const qrCodeImage = await qrcode.toDataURL(payload);
    return { qrCodeImage, serverUrl: baseUrl, username: user.username };
  }

  // ─── Subscription Automation ──────────────────────────────────────────────

  @Cron('0 8 * * *')
  async dailyExpiryCheck(): Promise<void> {
    this.logger.log('Running daily expiry check');
    const now = new Date();

    // Expire users whose time is up
    const expired = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      select: { id: true, username: true, resellerId: true },
    });

    for (const u of expired) {
      await this.prisma.user.update({ where: { id: u.id }, data: { status: 'EXPIRED' } });
      await this.userRepo.closeAllUserConnections(u.id).catch(() => {});
      await this.logNotification(u.id, 'EXPIRED', `${u.username} aboneliği sona erdi`);
    }
    if (expired.length > 0) this.logger.log(`Expired ${expired.length} users`);

    // Send expiry warning emails
    const WARN_DAYS = [7, 3, 1];
    for (const days of WARN_DAYS) {
      const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const dayStart = new Date(threshold); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(threshold); dayEnd.setHours(23, 59, 59, 999);

      const expiring = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          expiresAt: { gte: dayStart, lte: dayEnd },
        },
        include: { reseller: { select: { email: true, username: true } } },
      });

      for (const u of expiring) {
        // Dedup: only one notification per user per day per type
        const already = await this.prisma.notificationLog.findFirst({
          where: {
            type: `EXPIRY_${days}D`,
            recipient: u.id,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        });
        if (already) continue;

        await this.sendExpiryWarning(u, days);
        await this.logNotification(u.id, `EXPIRY_${days}D`, `${u.username} ${days} gün içinde sona eriyor`);
      }
    }
  }

  private async sendExpiryWarning(user: { id: string; username: string; reseller?: { email: string; username: string } | null }, days: number) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !user.reseller?.email) return;
    const urgency = days === 1 ? '🚨 SON UYARI' : days === 3 ? '⚠️ Acil' : '📅 Bilgi';
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'XtreamPulsar <noreply@xtreampulsar.io>',
          to: [user.reseller.email],
          subject: `${urgency}: ${user.username} kullanıcısı ${days} gün içinde sona eriyor`,
          html: `<p>Merhaba ${user.reseller.username},</p><p><strong>${user.username}</strong> kullanıcısının aboneliği <strong>${days} gün içinde</strong> sona erecek.</p><p>Kullanıcıyı yenilemek için panele giriş yapın.</p>`,
        }),
      });
    } catch (err) {
      this.logger.error(`Expiry warning email failed: ${(err as Error).message}`);
    }
  }

  private async logNotification(recipient: string, type: string, subject: string) {
    await this.prisma.notificationLog.create({
      data: { type, recipient, subject, status: 'SENT' },
    }).catch(() => {});
  }

  async bulkRenew(userIds: string[], packageId: string): Promise<{ renewed: number; failed: number; errors: string[] }> {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException(`Package ${packageId} not found`);

    let renewed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const user = await this.prisma.user.findFirst({
          where: { id: userId, deletedAt: null },
          include: { reseller: { select: { id: true, credits: true } } },
        });
        if (!user) { failed++; errors.push(`${userId}: not found`); continue; }

        if (user.reseller && user.reseller.credits < pkg.creditCost) {
          failed++;
          errors.push(`${user.username}: insufficient credits`);
          continue;
        }

        const base = user.expiresAt > new Date() ? user.expiresAt : new Date();
        const newExpiry = new Date(base.getTime() + pkg.durationDays * 24 * 60 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { expiresAt: newExpiry, status: 'ACTIVE', maxConnections: pkg.maxConnections },
          });
          if (user.reseller) {
            await tx.reseller.update({
              where: { id: user.reseller!.id },
              data: { credits: { decrement: pkg.creditCost } },
            });
          }
        });
        renewed++;
      } catch (err) {
        failed++;
        errors.push(`${userId}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Bulk renew: ${renewed} renewed, ${failed} failed`);
    return { renewed, failed, errors };
  }

  async countExpiringSoon(days = 7): Promise<number> {
    const now = new Date();
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.prisma.user.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        expiresAt: { gte: now, lte: threshold },
      },
    });
  }

  async logActivity(
    userId: string,
    action: 'LOGIN' | 'STREAM_START' | 'STREAM_STOP' | 'PASSWORD_CHANGE',
    opts?: { streamId?: string; ip?: string; userAgent?: string },
  ): Promise<void> {
    try {
      await this.prisma.userActivityLog.create({
        data: { userId, action, ...opts },
      });
    } catch { /* non-fatal */ }
  }

  async getActivityLog(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.userActivityLog.count({ where: { userId } }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getUserReport() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [statusCounts, resellerBreakdown, trendRaw] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['resellerId'],
        where: { deletedAt: null },
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE_TRUNC('day', "created_at") AS day, COUNT(*)::bigint AS count
        FROM users
        WHERE created_at >= ${thirtyDaysAgo} AND deleted_at IS NULL
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    const resellerIds = resellerBreakdown
      .filter((r) => r.resellerId)
      .map((r) => r.resellerId as string);

    const resellers = await this.prisma.reseller.findMany({
      where: { id: { in: resellerIds } },
      select: { id: true, username: true },
    });

    const resellerMap = Object.fromEntries(resellers.map((r) => [r.id, r.username]));

    return {
      statusBreakdown: Object.fromEntries(
        statusCounts.map((s) => [s.status, s._count._all]),
      ),
      resellerBreakdown: resellerBreakdown.map((r) => ({
        resellerId: r.resellerId,
        resellerName: r.resellerId ? (resellerMap[r.resellerId] ?? 'Bilinmeyen') : 'Direkt',
        count: r._count._all,
      })),
      trend: trendRaw.map((t) => ({
        day: t.day.toISOString().slice(0, 10),
        count: Number(t.count),
      })),
    };
  }

  async getUserStats(userId: string) {
    await this.assertExists(userId);

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [thisMonthConns, lastMonthConns, topStreamsRaw, totalDurationRaw] = await Promise.all([
      this.prisma.connection.count({
        where: { userId, startedAt: { gte: startOfThisMonth } },
      }),
      this.prisma.connection.count({
        where: { userId, startedAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      this.prisma.connection.groupBy({
        by: ['streamId'],
        where: { userId, endedAt: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { streamId: 'desc' } },
        take: 5,
      }),
      this.prisma.$queryRaw<Array<{ total_seconds: number }>>`
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("ended_at", NOW()) - "started_at"))), 0)::int AS total_seconds
        FROM connections
        WHERE "user_id" = ${userId}
      `,
    ]);

    const streamIds = topStreamsRaw.map((r) => r.streamId);
    const streams = await this.prisma.stream.findMany({
      where: { id: { in: streamIds } },
      select: { id: true, name: true, tvgLogo: true },
    });
    const streamMap = Object.fromEntries(streams.map((s) => [s.id, s]));

    return {
      totalWatchSeconds: totalDurationRaw[0]?.total_seconds ?? 0,
      thisMonthConnections: thisMonthConns,
      lastMonthConnections: lastMonthConns,
      topChannels: topStreamsRaw.map((r) => ({
        streamId: r.streamId,
        name: streamMap[r.streamId]?.name ?? 'Bilinmeyen',
        tvgLogo: streamMap[r.streamId]?.tvgLogo ?? null,
        count: r._count._all,
      })),
    };
  }

  private async assertExists(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
