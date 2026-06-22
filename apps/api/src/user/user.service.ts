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
    if (!user || user.deletedAt) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
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
    if (user.expiresAt < new Date()) {
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
    const { password: _, packageId: __, bouquetIds, ...rest } = dto;

    const user = await this.prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        expiresAt: new Date(dto.expiresAt),
        role: (dto.role ?? 'USER') as 'ADMIN' | 'RESELLER' | 'USER',
      },
      select: {
        id: true, username: true, role: true, status: true,
        maxConnections: true, expiresAt: true, createdAt: true,
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

  private async assertExists(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
