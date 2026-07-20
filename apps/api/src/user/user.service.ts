import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cron } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository, activeConnectionWhere } from './user.repository';
import { WebhookService } from '../webhook/webhook.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { BulkActionDto } from './dto/bulk-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
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
      // Also accept an active playlist token as credential (for token-based stream access)
      const tokenMatch = await this.prisma.userPlaylist.findFirst({
        where: {
          userId: user.id,
          token: password,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
        },
        select: { id: true },
      });
      if (!tokenMatch) {
        this.logger.debug(`[findByCredentials] password mismatch for "${username}" — hash prefix: ${user.password.slice(0, 7)}`);
        return null;
      }
      this.logger.debug(`[findByCredentials] playlist token match for "${username}"`);
    }

    this.logger.debug(`[findByCredentials] OK: "${username}" id=${user.id} role=${user.role} status=${user.status}`);
    return user;
  }

  async findById(id: string) {
    return this.userRepo.findById(id);
  }

  private ipMetaCache = new Map<string, { cc: string; proxy: boolean; ts: number }>();
  /** ip-api.com ile ülke + proxy/hosting (VPN) tespiti — 1 saat cache, özel IP'lerde atla. */
  private async lookupIpMeta(ip: string): Promise<{ cc: string; proxy: boolean } | null> {
    if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return null;
    const cached = this.ipMetaCache.get(ip);
    const now = Date.now();
    if (cached && now - cached.ts < 3_600_000) return { cc: cached.cc, proxy: cached.proxy };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,proxy,hosting`, { signal: controller.signal });
      clearTimeout(timer);
      const d = (await res.json()) as { countryCode?: string; proxy?: boolean; hosting?: boolean };
      const meta = { cc: d.countryCode ?? '', proxy: Boolean(d.proxy || d.hosting) };
      this.ipMetaCache.set(ip, { ...meta, ts: now });
      return meta;
    } catch {
      return null;
    }
  }

  async validateConnection(userId: string, ip: string, _userAgent?: string, perIpCap?: number) {
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

    // Engellenen denemeleri kaydeden yardimci (fire-and-forget — deny gecikmesine etkisi yok)
    const deny = (reason: string, category: string, cc?: string | null) => {
      this.logBlockedAttempt({ userId, username: user.username, ip, userAgent: _userAgent, reason, category, cc: cc ?? null });
      return { allowed: false, reason };
    };

    const active = await this.userRepo.countActiveConnections(userId);
    if (active >= user.maxConnections) {
      return deny(`Max connections reached (${user.maxConnections})`, 'MAX_CONN');
    }

    // Anti-restream: per-IP aktif bağlantı tavanı. Çağıran (guard) verirse onu,
    // vermezse env MAX_CONNECTIONS_PER_IP'yi kullan (mevcut davranış korunur). 0 = kapalı.
    const cap = perIpCap ?? parseInt(process.env.MAX_CONNECTIONS_PER_IP ?? '0', 10);
    if (cap > 0 && ip) {
      const ipActive = await this.userRepo.countActiveConnectionsByIp(ip);
      if (ipActive >= cap) {
        return deny(`IP connection limit reached (${cap})`, 'IP_CAP');
      }
    }

    // ── Hat erişim kontrolü (anti-abuse) ────────────────────────────────
    // IP allowlist (lookup gerektirmez)
    const allowedIps = (user as { allowedIps?: string[] }).allowedIps ?? [];
    if (allowedIps.length > 0 && ip && !allowedIps.includes(ip)) {
      return deny('IP not allowed for this line', 'IP_NOT_ALLOWED');
    }
    // Ülke kilidi + VPN engelleme (yalnız gerektiğinde ip-api sorgusu)
    const allowedCountries = (user as { allowedCountries?: string[] }).allowedCountries ?? [];
    const blockVpn = (user as { blockVpn?: boolean }).blockVpn ?? false;
    if ((allowedCountries.length > 0 || blockVpn) && ip) {
      const meta = await this.lookupIpMeta(ip);
      if (meta) {
        if (allowedCountries.length > 0 && meta.cc && !allowedCountries.includes(meta.cc)) {
          return deny(`Country ${meta.cc} not allowed for this line`, 'COUNTRY_BLOCKED', meta.cc);
        }
        if (blockVpn && meta.proxy) {
          return deny('VPN/proxy not allowed for this line', 'VPN_BLOCKED', meta.cc);
        }
      }
    }
    // Cihaz kilidi (user-agent parmak izi; ilk cihaza otomatik kilitlenir)
    const lockDevice = (user as { lockDevice?: boolean }).lockDevice ?? false;
    if (lockDevice && _userAgent) {
      const fp = crypto.createHash('sha256').update(_userAgent).digest('hex').slice(0, 24);
      const locked = (user as { lockedDeviceId?: string | null }).lockedDeviceId ?? null;
      if (!locked) {
        await this.prisma.user.update({ where: { id: userId }, data: { lockedDeviceId: fp } });
      } else if (locked !== fp) {
        return deny('Device locked to another device', 'DEVICE_LOCKED');
      }
    }

    return { allowed: true };
  }

  // Abonelik geçerlilik kapısı (status + expiry, bağlantı sayımı YOK). Playlist
  // (get.php) ve segment servisi için kullanılır. ADMIN/RESELLER expiry'den muaf.
  private evalSubscription(
    user: { status: string; role: string; expiresAt: Date | null; deletedAt: Date | null } | null,
  ): { allowed: boolean; reason?: string } {
    if (!user || user.deletedAt) return { allowed: false, reason: 'User not found' };
    if (user.status !== 'ACTIVE') return { allowed: false, reason: `Account ${user.status.toLowerCase()}` };
    if (user.role === 'ADMIN' || user.role === 'RESELLER') return { allowed: true };
    if (!user.expiresAt || user.expiresAt < new Date()) return { allowed: false, reason: 'Account expired' };
    return { allowed: true };
  }

  async checkSubscriptionActive(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.userRepo.findById(userId);
    return this.evalSubscription(user);
  }

  // C3: bir HLS segment token'ını aktif bir bağlantıya ve o bağlantının hâlâ
  // geçerli (status ACTIVE + expiresAt) kullanıcısına çözer. Token yoksa/kapalı
  // bağlantıysa/kullanıcı geçersizse false → segment servis edilmez.
  async validateSegmentToken(token: string): Promise<boolean> {
    const conn = await this.prisma.connection.findFirst({
      where: { token, endedAt: null },
      select: { user: { select: { status: true, role: true, expiresAt: true, deletedAt: true } } },
    });
    if (!conn?.user) return false;
    return this.evalSubscription(conn.user).allowed;
  }

  async createConnection(userId: string, streamId: string, ip: string, userAgent?: string, serverId?: string, token?: string) {
    return this.userRepo.createConnection({ userId, streamId, ip, userAgent, serverId, token });
  }

  async findOrCreateConnection(userId: string, streamId: string, ip: string, userAgent?: string, serverId?: string, token?: string) {
    return this.userRepo.findOrCreateConnection({ userId, streamId, ip, userAgent, serverId, token });
  }

  // Zap fix: yeni stream açılırken kullanıcının diğer stream'lerdeki eski/aynı-cihaz
  // bağlantılarını kapat (limit sayımından ÖNCE çağrılmalı).
  async closeSupersededConnections(userId: string, keepStreamId: string, ip: string, userAgent?: string) {
    return this.userRepo.closeSupersededConnections(userId, keepStreamId, ip, userAgent);
  }

  async closeConnection(connectionId: string): Promise<void> {
    return this.userRepo.closeConnection(connectionId);
  }

  // Heartbeat: uzun VOD/series proxy'si sürerken bağlantıyı canlı tut (stale-cron'a karşı).
  async touchConnection(id: string): Promise<void> {
    return this.userRepo.touchConnection(id);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 20, search, resellerId, status, expiring_soon, isTrial } = query;
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
      ...(isTrial !== undefined ? { isTrial } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, role: true, status: true,
          maxConnections: true, expiresAt: true, notes: true,
          plainPassword: true,
          allowedIps: true, allowedCountries: true, blockVpn: true, lockDevice: true,
          createdAt: true, resellerId: true,
          // Yalnız gerçekten aktif (taze) bağlantıları say — hayalet "1/1" olmasın.
          _count: { select: { connections: { where: activeConnectionWhere() } } },
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
        // NOT: Reseller kredi düşümü BURADA yapılmaz. Tek kaynak, ledger'lı düşüm
        // UserController.create içindeki resellerService.deductCredits'tir (K3 —
        // çifte tahsilat kaldırıldı).
      }
    }

    if (!resolvedExpiresAt) {
      // Default: 30 days if nothing provided
      const now = new Date();
      resolvedExpiresAt = new Date(now.getTime() + 30 * 86_400_000);
    }

    let user: { id: string; username: string; role: string; status: string; maxConnections: number; expiresAt: Date; createdAt: Date; packageId: string | null };
    try {
      user = await this.prisma.user.create({
        data: {
          ...rest,
          password: hashed,
          plainPassword: dto.password,
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Username "${dto.username}" already taken`);
      }
      throw err;
    }

    // Öncelik: açık seçim → paket bouquet'leri → Default. Kimse bouquet'siz kalmaz.
    const finalBouquetIds = await this.resolveBouquetIds(bouquetIds, packageId);
    if (finalBouquetIds.length > 0) {
      await this.prisma.userBouquet.createMany({
        data: finalBouquetIds.map((bouquetId) => ({ userId: user.id, bouquetId })),
        skipDuplicates: true,
      });
    }

    void this.webhookService.triggerWebhook('user.created', {
      userId: user.id,
      username: user.username,
      expiresAt: user.expiresAt?.toISOString() ?? null,
      resellerId: dto.resellerId ?? null,
    }).catch(() => {});

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.assertExists(id);

    const { bouquetIds, ...updateFields } = dto;
    const data: Record<string, unknown> = { ...updateFields };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 12);
      data.plainPassword = dto.password;
    }
    if (dto.expiresAt) {
      data.expiresAt = new Date(dto.expiresAt);
    }
    // Cihaz kilidi kapatılınca kilitli cihazı sıfırla (tekrar açılınca yeni cihaza kilitlensin)
    if (dto.lockDevice === false) {
      data.lockedDeviceId = null;
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

    const isExpiredStatus = user.status === 'DISABLED' || (user.expiresAt && user.expiresAt < new Date());
    if (isExpiredStatus) {
      void this.webhookService.triggerWebhook('user.expired', {
        userId: user.id,
        username: user.username,
        status: user.status,
        expiresAt: user.expiresAt?.toISOString() ?? null,
      }).catch(() => {});
    }

    return user;
  }

  // Kullanıcının atanmış bouquet'leri (id + ad). Detay drawer'ında görünürlük için.
  async getUserBouquets(id: string): Promise<{ id: string; name: string }[]> {
    await this.assertExists(id);
    const rows = await this.prisma.userBouquet.findMany({
      where: { userId: id },
      select: { bouquet: { select: { id: true, name: true } } },
      orderBy: { bouquet: { name: 'asc' } },
    });
    return rows.map((r) => r.bouquet);
  }

  async softDelete(id: string): Promise<void> {
    await this.assertExists(id);
    // O9: ban gibi, silinen kullanıcının açık bağlantılarını kapat — aksi halde
    // Connection satırları endedAt=null kalıp "online" sayacını şişirir.
    await this.userRepo.closeAllUserConnections(id);
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
      // O7: uzatma trial'ı kalıcı kullanıcıya çevirir — trial bayraklarını temizle.
      data: { expiresAt: newExpiry, status: 'ACTIVE', isTrial: false, trialEndsAt: null },
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
      where: { userId: id, ...activeConnectionWhere() },
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
          // O7: uzatılan trial kalıcıya döner — trial bayraklarını temizle.
          data: { expiresAt: new Date(base.getTime() + days * 24 * 60 * 60 * 1000), isTrial: false, trialEndsAt: null },
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

  async bulkAction(dto: BulkActionDto): Promise<{
    affected: number;
    results?: { userId: string; username: string; newPassword: string }[];
  }> {
    const { userIds, action, value } = dto;

    switch (action) {
      case 'extend': {
        const days = Math.max(1, parseInt(String(value ?? 30), 10));
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds }, deletedAt: null },
          select: { id: true, expiresAt: true },
        });
        await Promise.all(users.map((u) => {
          const base = u.expiresAt > new Date() ? u.expiresAt : new Date();
          return this.prisma.user.update({
            where: { id: u.id },
            data: { expiresAt: new Date(base.getTime() + days * 86_400_000) },
          });
        }));
        return { affected: users.length };
      }

      case 'suspend': {
        const r = await this.prisma.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data: { status: 'BANNED' },
        });
        return { affected: r.count };
      }

      case 'activate': {
        const r = await this.prisma.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data: { status: 'ACTIVE' },
        });
        return { affected: r.count };
      }

      case 'delete': {
        const r = await this.prisma.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data: { status: 'DISABLED', deletedAt: new Date() },
        });
        return { affected: r.count };
      }

      case 'reset-password': {
        const users = await this.prisma.user.findMany({
          where: { id: { in: userIds }, deletedAt: null },
          select: { id: true, username: true },
        });
        const results: { userId: string; username: string; newPassword: string }[] = [];
        for (const u of users) {
          const newPassword = this.makeRandomPassword();
          const hashed = await bcrypt.hash(newPassword, 12);
          await this.prisma.user.update({ where: { id: u.id }, data: { password: hashed, plainPassword: newPassword } });
          results.push({ userId: u.id, username: u.username, newPassword });
        }
        return { affected: users.length, results };
      }

      case 'package-assign': {
        const pkg = await this.prisma.package.findUnique({ where: { id: String(value ?? '') } });
        if (!pkg) throw new NotFoundException(`Package ${String(value)} not found`);
        // O5: kalan süreyi koru — mevcut expiresAt gelecekteyse ondan, değilse
        // now'dan başlat (diğer renewal yolları ile aynı base mantığı). updateMany
        // tek expiry uyguladığından kullanıcı bazında güncelliyoruz.
        const targets = await this.prisma.user.findMany({
          where: { id: { in: userIds }, deletedAt: null },
          select: { id: true, expiresAt: true },
        });
        const now = new Date();
        // Paket bouquet'leri (yoksa Default). Mevcut özel seçim SİLİNMEZ — sadece
        // eklenir (skipDuplicates), böylece kullanıcı paketin kanallarını garanti alır
        // ve hiç bouquet'i yoksa boş playlist kalmaz.
        const pkgBouquetIds = await this.resolveBouquetIds(undefined, pkg.id);
        await Promise.all(
          targets.map(async (u) => {
            const base = u.expiresAt > now ? u.expiresAt : now;
            const expiresAt = new Date(base.getTime() + pkg.durationDays * 86_400_000);
            await this.prisma.user.update({
              where: { id: u.id },
              // O7: paket atama trial'ı kalıcıya çevirir — trial bayraklarını temizle.
              data: {
                packageId: pkg.id,
                maxConnections: pkg.maxConnections,
                expiresAt,
                status: 'ACTIVE',
                isTrial: false,
                trialEndsAt: null,
              },
            });
            if (pkgBouquetIds.length > 0) {
              await this.prisma.userBouquet.createMany({
                data: pkgBouquetIds.map((bouquetId) => ({ userId: u.id, bouquetId })),
                skipDuplicates: true,
              });
            }
          }),
        );
        return { affected: targets.length };
      }

      case 'bouquet-assign': {
        const bouquetId = String(value ?? '');
        if (!bouquetId) throw new BadRequestException('bouquetId is required');
        await this.prisma.userBouquet.createMany({
          data: userIds.map((userId) => ({ userId, bouquetId })),
          skipDuplicates: true,
        });
        return { affected: userIds.length };
      }

      case 'max-connections': {
        const maxConn = Math.max(1, parseInt(String(value ?? 1), 10));
        const r = await this.prisma.user.updateMany({
          where: { id: { in: userIds }, deletedAt: null },
          data: { maxConnections: maxConn },
        });
        return { affected: r.count };
      }

      default:
        throw new BadRequestException(`Unknown bulk action: ${action}`);
    }
  }

  private makeRandomPassword(length = 8): string {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  // "Default" bouquet'i bul/oluştur (migration.service.getOrCreateDefaultBouquet ile
  // aynı mekanizma — isimle eşleşen tekil bouquet).
  private async getDefaultBouquetId(): Promise<string> {
    let bouquet = await this.prisma.bouquet.findFirst({ where: { name: 'Default' }, select: { id: true } });
    if (!bouquet) bouquet = await this.prisma.bouquet.create({ data: { name: 'Default' }, select: { id: true } });
    return bouquet.id;
  }

  // Kullanıcı bouquet ataması öncelik sırası:
  //   a) Açıkça seçilen bouquet'ler (en yüksek öncelik)
  //   b) Yoksa ve paket seçiliyse → paketin bouquet'leri (miras)
  //   c) İkisi de yoksa → Default bouquet (fallback)
  // Hiçbir kullanıcı bouquet'siz kalmaz.
  async resolveBouquetIds(explicit: string[] | undefined, packageId: string | undefined): Promise<string[]> {
    if (explicit && explicit.length > 0) return explicit;
    if (packageId) {
      const pkg = await this.prisma.package.findUnique({
        where: { id: packageId },
        select: { bouquets: { select: { id: true } } },
      });
      const ids = pkg?.bouquets.map((b) => b.id) ?? [];
      if (ids.length > 0) return ids;
    }
    return [await this.getDefaultBouquetId()];
  }

  async quickCreate(dto: {
    username?: string;
    password?: string;
    durationDays?: number;
    durationHours?: number;
    maxConnections: number;
    notes?: string;
  }): Promise<{ user: { id: string; username: string; password: string; expiresAt: Date }; m3uUrl: string; playerApiUrl: string }> {
    if (!dto.durationDays && !dto.durationHours) {
      throw new BadRequestException('durationDays veya durationHours gerekli');
    }

    const username = dto.username?.trim() || this.makeRandomPassword(8).toLowerCase();
    const rawPassword = dto.password?.trim() || this.makeRandomPassword(8);

    // Ensure username is unique — append 3 random chars if taken
    let finalUsername = username;
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      finalUsername = `${username}${this.makeRandomPassword(3).toLowerCase()}`;
    }

    const hashed = await bcrypt.hash(rawPassword, 12);
    const msToAdd = dto.durationHours
      ? dto.durationHours * 3_600_000
      : (dto.durationDays ?? 30) * 86_400_000;
    const expiresAt = new Date(Date.now() + msToAdd);

    const user = await this.prisma.user.create({
      data: {
        username: finalUsername,
        password: hashed,
        plainPassword: rawPassword,
        maxConnections: dto.maxConnections,
        expiresAt,
        status: 'ACTIVE',
        role: 'USER',
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      select: { id: true, username: true, expiresAt: true },
    });

    // quickCreate paket/bouquet almıyor → Default ata (boş playlist olmasın).
    await this.prisma.userBouquet.createMany({
      data: (await this.resolveBouquetIds(undefined, undefined)).map((bouquetId) => ({ userId: user.id, bouquetId })),
      skipDuplicates: true,
    });

    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const baseUrl = settings?.serverUrl
      ? `${settings.serverUrl}:${settings.serverPort ?? 25461}`
      : `http://localhost:${settings?.serverPort ?? 25461}`;

    const m3uUrl = `${baseUrl}/get.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(rawPassword)}&type=m3u_plus`;
    const playerApiUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(rawPassword)}`;

    return { user: { ...user, password: rawPassword }, m3uUrl, playerApiUrl };
  }

  async createTrialUser(dto: {
    username?: string;
    password?: string;
    durationDays?: number;
    maxConnections?: number;
  }): Promise<{ user: { id: string; username: string; password: string; expiresAt: Date }; m3uUrl: string }> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const trialDays = dto.durationDays ?? (settings as Record<string, unknown> & { trialDays?: number })?.trialDays ?? 7;
    const trialMaxConn = dto.maxConnections ?? (settings as Record<string, unknown> & { trialMaxConnections?: number })?.trialMaxConnections ?? 1;

    // O6: trialUserLimit uygulaması (0/null => sınırsız). Aktif trial sayısı limiti
    // aşıyorsa yeni trial reddedilir.
    const trialUserLimit = (settings as Record<string, unknown> & { trialUserLimit?: number })?.trialUserLimit ?? 0;
    if (trialUserLimit > 0) {
      const activeTrials = await this.prisma.user.count({
        where: { isTrial: true, deletedAt: null, status: { not: 'DISABLED' } },
      });
      if (activeTrials >= trialUserLimit) {
        throw new ForbiddenException(`Trial kullanıcı limitine ulaşıldı (maks: ${trialUserLimit})`);
      }
    }

    const username = dto.username?.trim() || `trial_${this.makeRandomPassword(6).toLowerCase()}`;
    const rawPassword = dto.password?.trim() || this.makeRandomPassword(8);

    let finalUsername = username;
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) finalUsername = `${username}${this.makeRandomPassword(3).toLowerCase()}`;

    const hashed = await bcrypt.hash(rawPassword, 12);
    const expiresAt = new Date(Date.now() + trialDays * 86_400_000);

    const user = await this.prisma.user.create({
      data: {
        username: finalUsername,
        password: hashed,
        plainPassword: rawPassword,
        maxConnections: trialMaxConn,
        expiresAt,
        trialEndsAt: expiresAt,
        isTrial: true,
        status: 'ACTIVE',
        role: 'USER',
      },
      select: { id: true, username: true, expiresAt: true },
    });

    // Trial de bouquet almıyor → Default ata (boş playlist olmasın).
    await this.prisma.userBouquet.createMany({
      data: (await this.resolveBouquetIds(undefined, undefined)).map((bouquetId) => ({ userId: user.id, bouquetId })),
      skipDuplicates: true,
    });

    const baseUrl = settings?.serverUrl
      ? `${settings.serverUrl}:${settings.serverPort ?? 25461}`
      : `http://localhost:${settings?.serverPort ?? 25461}`;

    const m3uUrl = `${baseUrl}/get.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(rawPassword)}&type=m3u_plus`;
    return { user: { ...user, password: rawPassword }, m3uUrl };
  }

  // HLS istemcisi "ayrıldım" sinyali göndermez; hayalet (endedAt=null ama
  // STALE_CONNECTION_MS'ten eski) bağlantıları her dakika kapat. Aksi halde
  // maxConnections kotası dolu kalıp kullanıcı kendi hesabıyla yayın açamaz.
  @Cron('* * * * *')
  async closeStaleConnections(): Promise<void> {
    try {
      const res = await this.userRepo.closeStaleConnections();
      if (res.count > 0) {
        this.logger.log(`Stale connection cleanup: ${res.count} hayalet bağlantı kapatıldı`);
      }
    } catch (err) {
      this.logger.error(`Stale connection cleanup failed: ${(err as Error).message}`);
    }
  }

  @Cron('0 1 * * *')
  async expiredTrialUsers(): Promise<void> {
    const result = await this.prisma.user.updateMany({
      where: {
        isTrial: true,
        status: { not: 'DISABLED' },
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'DISABLED' },
    });
    if (result.count > 0) {
      this.logger.log(`Trial cleanup: ${result.count} expired trial account(s) disabled`);
    }
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
      await this.logNotification(u.id, 'EXPIRED', `${u.username} aboneliği sona erdi`, 'expired', { username: u.username });
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
        await this.logNotification(u.id, `EXPIRY_${days}D`, `${u.username} ${days} gün içinde sona eriyor`, 'expiryWarning', { username: u.username, days });
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

  /** Engellenen baglanti denemesini kaydeder. Fire-and-forget; ulke yoksa cache'li ip-api ile zenginlestirir. */
  private logBlockedAttempt(d: {
    userId?: string;
    username?: string | null;
    ip?: string;
    userAgent?: string;
    reason: string;
    category: string;
    cc?: string | null;
  }): void {
    void (async () => {
      try {
        let country = d.cc ?? null;
        if (!country && d.ip) {
          const m = await this.lookupIpMeta(d.ip);
          country = m?.cc || null;
        }
        await this.prisma.blockedAttempt.create({
          data: {
            userId: d.userId ?? null,
            username: d.username ?? null,
            ip: d.ip || null,
            country,
            reason: d.reason,
            category: d.category,
            userAgent: d.userAgent ? d.userAgent.slice(0, 200) : null,
          },
        });
      } catch {
        /* fire-and-forget */
      }
    })();
  }

  private async logNotification(
    recipient: string,
    type: string,
    subject: string,
    messageKey?: string,
    messageParams?: Record<string, unknown>,
  ) {
    await this.prisma.notificationLog.create({
      data: {
        type,
        recipient,
        subject,
        status: 'SENT',
        ...(messageKey ? { messageKey } : {}),
        ...(messageParams ? { messageParams } : {}),
      },
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
            // O7: yenileme trial'ı kalıcıya çevirir — trial bayraklarını temizle.
            data: {
              expiresAt: newExpiry,
              status: 'ACTIVE',
              maxConnections: pkg.maxConnections,
              isTrial: false,
              trialEndsAt: null,
            },
          });
          if (user.reseller) {
            await tx.reseller.update({
              where: { id: user.reseller!.id },
              data: { credits: { decrement: pkg.creditCost } },
            });
            // O1: bakiye/ledger sapmasını önlemek için aynı transaction'da ledger yaz.
            await tx.resellerCreditLog.create({
              data: {
                resellerId: user.reseller!.id,
                amount: pkg.creditCost,
                type: 'DEDUCT',
                reason: `Toplu yenileme: ${user.username} (${pkg.name})`,
                balanceAfter: user.reseller!.credits - pkg.creditCost,
              },
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
