import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@xtreampulsar/database';
import { PaymentRequiredException } from '../common/exceptions/payment-required.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';

@Injectable()
export class ResellerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  findAll() {
    return this.prisma.reseller.findMany({
      where: { deletedAt: null },
      select: {
        id: true, username: true, email: true, credits: true,
        tier: true, isActive: true, parentId: true, notes: true, createdAt: true,
        _count: { select: { users: true } },
        parent: { select: { id: true, username: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, username: true, credits: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHierarchyTree() {
    const childSelect = {
      id: true, username: true, email: true, credits: true,
      tier: true, isActive: true, createdAt: true,
      _count: { select: { users: true } },
    } as const;

    return this.prisma.reseller.findMany({
      where: { parentId: null, deletedAt: null },
      select: {
        ...childSelect,
        children: {
          where: { deletedAt: null },
          select: {
            ...childSelect,
            children: { where: { deletedAt: null }, select: childSelect },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async transferCredits(fromResellerId: string, toResellerId: string, amount: number) {
    const [from, to] = await Promise.all([
      this.prisma.reseller.findFirst({ where: { id: fromResellerId, deletedAt: null }, select: { id: true, username: true, credits: true } }),
      this.prisma.reseller.findFirst({ where: { id: toResellerId, deletedAt: null }, select: { id: true, username: true, credits: true } }),
    ]);
    if (!from) throw new NotFoundException('Kaynak reseller bulunamadı');
    if (!to) throw new NotFoundException('Hedef reseller bulunamadı');
    if (from.credits < amount) {
      throw new PaymentRequiredException(`Yetersiz kredi (bakiye: ${from.credits}, gerekli: ${amount})`);
    }
    const fromNew = from.credits - amount;
    const toNew = to.credits + amount;

    await this.prisma.$transaction([
      this.prisma.reseller.update({ where: { id: fromResellerId }, data: { credits: { decrement: amount } } }),
      this.prisma.reseller.update({ where: { id: toResellerId }, data: { credits: { increment: amount } } }),
      this.prisma.resellerCreditLog.create({
        data: { resellerId: fromResellerId, amount, type: 'DEDUCT', reason: `${to.username} alt bayisine kredi transferi`, balanceAfter: fromNew },
      }),
      this.prisma.resellerCreditLog.create({
        data: { resellerId: toResellerId, amount, type: 'ADD', reason: `${from.username} üst bayisinden kredi transferi`, balanceAfter: toNew },
      }),
    ]);
    return { transferred: amount, fromBalance: fromNew, toBalance: toNew };
  }

  async getMySubResellers(resellerId: string) {
    return this.prisma.reseller.findMany({
      where: { parentId: resellerId, deletedAt: null },
      select: {
        id: true, username: true, email: true, credits: true,
        tier: true, isActive: true, createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubReseller(
    parentResellerId: string,
    dto: { username: string; password: string; email?: string; credits?: number; tier?: string },
  ) {
    const parent = await this.prisma.reseller.findFirst({
      where: { id: parentResellerId, deletedAt: null },
      select: { id: true, credits: true },
    });
    if (!parent) throw new NotFoundException('Üst reseller bulunamadı');

    const initialCredits = dto.credits ?? 0;
    if (initialCredits > 0 && parent.credits < initialCredits) {
      throw new PaymentRequiredException(`Yetersiz kredi (bakiye: ${parent.credits}, gerekli: ${initialCredits})`);
    }

    const orConds: { username?: string; email?: string }[] = [{ username: dto.username }];
    if (dto.email) orConds.push({ email: dto.email });
    const existing = await this.prisma.reseller.findFirst({ where: { OR: orConds, deletedAt: null } });
    if (existing) throw new ConflictException('Bu kullanıcı adı veya e-posta zaten kullanımda');

    const hashed = await bcrypt.hash(dto.password, 12);
    const parentNew = parent.credits - initialCredits;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.reseller.create({
        data: {
          username: dto.username,
          email: dto.email ?? null,
          password: hashed,
          credits: initialCredits,
          tier: (dto.tier ?? 'BASIC') as 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM',
          parent: { connect: { id: parentResellerId } },
        },
        select: { id: true, username: true, email: true, credits: true, tier: true, createdAt: true },
      });
      if (initialCredits > 0) {
        await tx.reseller.update({ where: { id: parentResellerId }, data: { credits: { decrement: initialCredits } } });
        await tx.resellerCreditLog.create({
          data: { resellerId: parentResellerId, amount: initialCredits, type: 'DEDUCT', reason: `${dto.username} alt bayi başlangıç kredisi`, balanceAfter: parentNew },
        });
      }
      return created;
    });
  }

  async findById(id: string) {
    const r = await this.prisma.reseller.findFirst({
      where: { id, deletedAt: null },
      include: { parent: true, _count: { select: { users: true, creditLogs: true } } },
    });
    if (!r) throw new NotFoundException(`Reseller ${id} not found`);
    return r;
  }

  async create(dto: CreateResellerDto) {
    const orConditions: { username?: string; email?: string }[] = [{ username: dto.username }];
    if (dto.email) orConditions.push({ email: dto.email });
    const existing = await this.prisma.reseller.findFirst({
      where: { OR: orConditions, deletedAt: null },
    });
    if (existing) throw new ConflictException('Username or email already in use');

    const hashed = await bcrypt.hash(dto.password, 12);
    try {
      return await this.prisma.reseller.create({
        data: {
          username: dto.username,
          email: dto.email ?? null,
          password: hashed,
          credits: dto.credits ?? 0,
          tier: (dto.tier ?? 'BASIC') as 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM',
          ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
        },
        select: { id: true, username: true, email: true, credits: true, tier: true, createdAt: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu kullanıcı adı zaten kullanılıyor');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateResellerDto) {
    await this.findById(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 12);
    return this.prisma.reseller.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.reseller.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async addCredits(id: string, amount: number, reason: string | undefined, adminId: string) {
    const reseller = await this.findById(id);
    const balanceAfter = reseller.credits + amount;

    const [updated] = await this.prisma.$transaction([
      this.prisma.reseller.update({
        where: { id },
        data: { credits: { increment: amount } },
        select: { id: true, username: true, credits: true },
      }),
      this.prisma.resellerCreditLog.create({
        data: { resellerId: id, amount, type: 'ADD', reason, balanceAfter, adminId },
      }),
    ]);

    return updated;
  }

  async deductCredits(resellerId: string, amount: number, reason?: string): Promise<void> {
    const reseller = await this.findById(resellerId);
    if (reseller.credits < amount) {
      throw new PaymentRequiredException(`Insufficient credits (have ${reseller.credits}, need ${amount})`);
    }
    await this.prisma.$transaction([
      this.prisma.reseller.update({
        where: { id: resellerId },
        data: { credits: { decrement: amount } },
      }),
      this.prisma.resellerCreditLog.create({
        data: {
          resellerId,
          amount,
          type: 'DEDUCT',
          reason,
          balanceAfter: reseller.credits - amount,
        },
      }),
    ]);
  }

  async getCreditHistory(id: string, page = 1, limit = 20, startDate?: Date) {
    await this.findById(id);
    const where = {
      resellerId: id,
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
    };
    const [items, total, allInPeriod] = await Promise.all([
      this.prisma.resellerCreditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.resellerCreditLog.count({ where }),
      this.prisma.resellerCreditLog.findMany({ where, select: { amount: true, type: true } }),
    ]);
    const added = allInPeriod.filter((i) => i.type === 'ADD').reduce((s, i) => s + i.amount, 0);
    const spent = allInPeriod.filter((i) => i.type === 'DEDUCT').reduce((s, i) => s + i.amount, 0);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit), summary: { added, spent } };
  }

  async getUsers(id: string, page = 1, limit = 20) {
    await this.findById(id);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { resellerId: id, deletedAt: null },
        select: {
          id: true, username: true, status: true,
          expiresAt: true, maxConnections: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { resellerId: id, deletedAt: null } }),
    ]);
    return { items, total, page, limit };
  }

  async getStats(id: string) {
    await this.findById(id);
    const now = new Date();

    const [total, active, expired, online] = await Promise.all([
      this.prisma.user.count({ where: { resellerId: id, deletedAt: null } }),
      this.prisma.user.count({ where: { resellerId: id, deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }),
      this.prisma.user.count({ where: { resellerId: id, deletedAt: null, expiresAt: { lt: now } } }),
      this.prisma.connection.count({
        where: { endedAt: null, user: { resellerId: id } },
      }),
    ]);

    return { totalUsers: total, activeUsers: active, expiredUsers: expired, onlineConnections: online };
  }

  // ─── Reseller self-service methods ───────────────────────────────────────────

  async getDashboard(resellerId: string) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const in7Days = new Date(now.getTime() + 7 * 86_400_000);

    const [reseller, total, active, newThisWeek, expiringSoon, online] = await Promise.all([
      this.prisma.reseller.findUnique({ where: { id: resellerId }, select: { credits: true } }),
      this.prisma.user.count({ where: { resellerId, deletedAt: null } }),
      this.prisma.user.count({ where: { resellerId, deletedAt: null, status: 'ACTIVE', expiresAt: { gte: now } } }),
      this.prisma.user.count({ where: { resellerId, deletedAt: null, createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { resellerId, deletedAt: null, expiresAt: { gte: now, lte: in7Days } } }),
      this.prisma.connection.count({ where: { endedAt: null, user: { resellerId } } }),
    ]);

    return {
      credits: reseller?.credits ?? 0,
      totalUsers: total,
      activeUsers: active,
      newThisWeek,
      expiringSoonCount: expiringSoon,
      onlineConnections: online,
    };
  }

  async getMyUsers(
    resellerId: string,
    page: number,
    limit: number,
    search?: string,
    status?: string,
    sortBy = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc',
    expiryFilter?: string,
  ) {
    const now = new Date();
    const expiryWhere: Prisma.UserWhereInput =
      expiryFilter === 'expired' ? { expiresAt: { lt: now } } :
      expiryFilter === 'thisWeek' ? { expiresAt: { gte: now, lte: new Date(now.getTime() + 7 * 86_400_000) } } :
      expiryFilter === 'thisMonth' ? { expiresAt: { gte: now, lte: new Date(now.getTime() + 30 * 86_400_000) } } :
      expiryFilter === 'active' ? { expiresAt: { gte: now }, status: 'ACTIVE' as const } :
      {};

    const where: Prisma.UserWhereInput = {
      resellerId,
      deletedAt: null,
      ...(search ? { username: { contains: search, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(status ? { status: status as 'ACTIVE' | 'DISABLED' | 'BANNED' } : {}),
      ...expiryWhere,
    };

    const validSort = ['username', 'expiresAt', 'createdAt'].includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.UserOrderByWithRelationInput = { [validSort]: sortDir };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, status: true,
          expiresAt: true, maxConnections: true, createdAt: true,
          _count: { select: { connections: { where: { endedAt: null } } } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMyUserDetail(resellerId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, resellerId, deletedAt: null },
      select: {
        id: true, username: true, status: true, maxConnections: true,
        expiresAt: true, notes: true, createdAt: true,
        _count: { select: { connections: { where: { endedAt: null } } } },
      },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return user;
  }

  async updateMyUser(
    resellerId: string,
    userId: string,
    dto: { maxConnections?: number; expiresAt?: string; notes?: string; status?: string },
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, resellerId, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const data: Record<string, unknown> = {};
    if (dto.maxConnections !== undefined) data.maxConnections = dto.maxConnections;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, status: true, maxConnections: true, expiresAt: true },
    });
  }

  async deleteMyUser(resellerId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, resellerId, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  }

  async quickCreateUser(
    resellerId: string,
    dto: {
      username?: string;
      password?: string;
      durationDays?: number;
      durationHours?: number;
      maxConnections: number;
      notes?: string;
    },
  ) {
    if (!dto.durationDays && !dto.durationHours) {
      throw new BadRequestException('durationDays veya durationHours gerekli');
    }

    const reseller = await this.prisma.reseller.findUnique({
      where: { id: resellerId },
      select: { credits: true },
    });
    if (!reseller) throw new NotFoundException('Reseller not found');

    const creditCost = 1;
    if (reseller.credits < creditCost) {
      throw new PaymentRequiredException(`Yetersiz kredi (bakiye: ${reseller.credits}, gerekli: ${creditCost})`);
    }

    const rawUsername = dto.username?.trim() || randomBytes(4).toString('hex');
    const rawPassword = dto.password?.trim() || randomBytes(4).toString('hex');

    const existing = await this.prisma.user.findUnique({ where: { username: rawUsername } });
    if (existing) throw new ConflictException(`Kullanıcı adı "${rawUsername}" zaten kullanımda`);

    const hashed = await bcrypt.hash(rawPassword, 12);
    const msToAdd = dto.durationHours
      ? dto.durationHours * 3_600_000
      : (dto.durationDays ?? 30) * 86_400_000;
    const expiresAt = new Date(Date.now() + msToAdd);
    const newBalance = reseller.credits - creditCost;

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          username: rawUsername,
          password: hashed,
          maxConnections: dto.maxConnections,
          expiresAt,
          notes: dto.notes,
          resellerId,
          status: 'ACTIVE',
        },
        select: { id: true, username: true, expiresAt: true },
      }),
      this.prisma.reseller.update({
        where: { id: resellerId },
        data: { credits: { decrement: creditCost } },
      }),
      this.prisma.resellerCreditLog.create({
        data: {
          resellerId,
          amount: creditCost,
          type: 'DEDUCT',
          reason: `Kullanıcı oluşturuldu: ${rawUsername}`,
          balanceAfter: newBalance,
        },
      }),
    ]);

    const serverUrl = this.config.get<string>('server.url') ?? 'http://localhost';
    const serverPort = this.config.get<number>('server.port') ?? 8080;
    const base = `${serverUrl}:${serverPort}`;

    return {
      user: { ...user, password: rawPassword },
      m3uUrl: `${base}/get.php?username=${encodeURIComponent(rawUsername)}&password=${encodeURIComponent(rawPassword)}&type=m3u_plus`,
      playerApiUrl: `${base}/player_api.php?username=${encodeURIComponent(rawUsername)}&password=${encodeURIComponent(rawPassword)}`,
    };
  }

  async quickCreateUserWithPackage(
    resellerId: string,
    dto: { username?: string; password?: string; packageId: string; notes?: string },
  ) {
    const [reseller, pkg] = await Promise.all([
      this.prisma.reseller.findUnique({ where: { id: resellerId }, select: { credits: true } }),
      this.prisma.package.findUnique({
        where: { id: dto.packageId },
        select: { id: true, name: true, durationDays: true, maxConnections: true, creditCost: true, isActive: true },
      }),
    ]);

    if (!reseller) throw new NotFoundException('Reseller not found');
    if (!pkg || !pkg.isActive) throw new NotFoundException('Paket bulunamadı veya aktif değil');
    if (reseller.credits < pkg.creditCost) {
      throw new PaymentRequiredException(
        `Yetersiz kredi (bakiye: ${reseller.credits}, gerekli: ${pkg.creditCost})`,
      );
    }

    const rawUsername = dto.username?.trim() || randomBytes(4).toString('hex');
    const rawPassword = dto.password?.trim() || randomBytes(4).toString('hex');

    const existing = await this.prisma.user.findUnique({ where: { username: rawUsername } });
    if (existing) throw new ConflictException(`Kullanıcı adı "${rawUsername}" zaten kullanımda`);

    const hashed = await bcrypt.hash(rawPassword, 12);
    const expiresAt = new Date(Date.now() + pkg.durationDays * 86_400_000);
    const newBalance = reseller.credits - pkg.creditCost;

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          username: rawUsername,
          password: hashed,
          maxConnections: pkg.maxConnections,
          expiresAt,
          notes: dto.notes,
          resellerId,
          status: 'ACTIVE',
        },
        select: { id: true, username: true, expiresAt: true },
      }),
      this.prisma.reseller.update({
        where: { id: resellerId },
        data: { credits: { decrement: pkg.creditCost } },
      }),
      this.prisma.resellerCreditLog.create({
        data: {
          resellerId,
          amount: pkg.creditCost,
          type: 'DEDUCT',
          reason: `Paket satışı (${pkg.name}): ${rawUsername}`,
          balanceAfter: newBalance,
        },
      }),
    ]);

    const serverUrl = this.config.get<string>('server.url') ?? 'http://localhost';
    const serverPort = this.config.get<number>('server.port') ?? 8080;
    const base = `${serverUrl}:${serverPort}`;

    return {
      user: { ...user, password: rawPassword },
      m3uUrl: `${base}/get.php?username=${encodeURIComponent(rawUsername)}&password=${encodeURIComponent(rawPassword)}&type=m3u_plus`,
      playerApiUrl: `${base}/player_api.php?username=${encodeURIComponent(rawUsername)}&password=${encodeURIComponent(rawPassword)}`,
    };
  }

  async updateProfile(resellerId: string, dto: { email?: string }) {
    const reseller = await this.findById(resellerId);
    if (dto.email && dto.email !== reseller.email) {
      const conflict = await this.prisma.reseller.findFirst({
        where: { email: dto.email, id: { not: resellerId }, deletedAt: null },
      });
      if (conflict) throw new ConflictException('Bu e-posta adresi zaten kullanımda');
    }
    return this.prisma.reseller.update({
      where: { id: resellerId },
      data: { email: dto.email ?? null },
      select: { id: true, username: true, email: true, tier: true, createdAt: true },
    });
  }

  async changePassword(resellerId: string, dto: { currentPassword: string; newPassword: string }) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id: resellerId } });
    if (!reseller) throw new NotFoundException('Reseller not found');
    const valid = await bcrypt.compare(dto.currentPassword, reseller.password);
    if (!valid) throw new UnauthorizedException('Mevcut şifre hatalı');
    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.reseller.update({ where: { id: resellerId }, data: { password: hashed } });
    return { message: 'Şifre güncellendi' };
  }

  async getBranding(resellerId: string) {
    const r = await this.prisma.reseller.findUnique({
      where: { id: resellerId },
      select: { brandName: true, logoUrl: true, primaryColor: true },
    });
    if (!r) throw new NotFoundException('Reseller not found');
    return r;
  }

  async updateBranding(resellerId: string, dto: { brandName?: string; primaryColor?: string }) {
    const data: { brandName?: string | null; primaryColor?: string | null } = {};
    if (dto.brandName !== undefined) data.brandName = dto.brandName.trim() || null;
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor.trim() || null;
    return this.prisma.reseller.update({
      where: { id: resellerId },
      data,
      select: { brandName: true, logoUrl: true, primaryColor: true },
    });
  }

  async uploadBrandingLogo(resellerId: string, file: Express.Multer.File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Sadece PNG, JPEG veya WebP formatı desteklenmektedir');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Dosya boyutu 2MB\'ı aşamaz');
    }
    const base64 = file.buffer.toString('base64');
    const logoUrl = `data:${file.mimetype};base64,${base64}`;
    return this.prisma.reseller.update({
      where: { id: resellerId },
      data: { logoUrl },
      select: { brandName: true, logoUrl: true, primaryColor: true },
    });
  }

  async extendUser(resellerId: string, userId: string, days: number) {
    const creditCost = Math.ceil(days / 30);

    const [reseller, user] = await Promise.all([
      this.prisma.reseller.findUnique({ where: { id: resellerId }, select: { credits: true } }),
      this.prisma.user.findFirst({ where: { id: userId, resellerId, deletedAt: null }, select: { id: true, username: true, expiresAt: true } }),
    ]);

    if (!reseller) throw new NotFoundException('Reseller not found');
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    if (reseller.credits < creditCost) {
      throw new PaymentRequiredException(`Yetersiz kredi (bakiye: ${reseller.credits}, gerekli: ${creditCost})`);
    }

    const now = new Date();
    const base = user.expiresAt > now ? user.expiresAt : now;
    const newExpiresAt = new Date(base.getTime() + days * 86_400_000);
    const newBalance = reseller.credits - creditCost;

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { expiresAt: newExpiresAt },
        select: { id: true, username: true, status: true, maxConnections: true, expiresAt: true, createdAt: true },
      }),
      this.prisma.reseller.update({
        where: { id: resellerId },
        data: { credits: { decrement: creditCost } },
      }),
      this.prisma.resellerCreditLog.create({
        data: {
          resellerId,
          amount: creditCost,
          type: 'DEDUCT',
          reason: `${user.username} için ${days} gün uzatma`,
          balanceAfter: newBalance,
        },
      }),
    ]);

    return updated;
  }

  async bulkAction(
    resellerId: string,
    action: 'extend' | 'suspend' | 'activate',
    userIds: string[],
    days?: number,
  ) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, resellerId, deletedAt: null },
      select: { id: true, expiresAt: true },
    });
    if (users.length === 0) throw new NotFoundException('Geçerli kullanıcı bulunamadı');

    const validIds = users.map((u) => u.id);
    const now = new Date();

    if (action === 'extend') {
      const addDays = days ?? 30;
      const addMs = addDays * 86_400_000;
      const creditCostPerUser = Math.ceil(addDays / 30);
      const totalCost = creditCostPerUser * users.length;

      const reseller = await this.prisma.reseller.findUnique({ where: { id: resellerId }, select: { credits: true } });
      if (!reseller || reseller.credits < totalCost) {
        throw new PaymentRequiredException(
          `Yetersiz kredi (bakiye: ${reseller?.credits ?? 0}, gerekli: ${totalCost})`,
        );
      }

      const newBalance = reseller.credits - totalCost;

      await this.prisma.$transaction([
        ...users.map((u) => {
          const base = u.expiresAt > now ? u.expiresAt : now;
          return this.prisma.user.update({
            where: { id: u.id },
            data: { expiresAt: new Date(base.getTime() + addMs) },
          });
        }),
        this.prisma.reseller.update({
          where: { id: resellerId },
          data: { credits: { decrement: totalCost } },
        }),
        this.prisma.resellerCreditLog.create({
          data: {
            resellerId,
            amount: totalCost,
            type: 'DEDUCT',
            reason: `${users.length} kullanıcı için ${addDays} gün toplu uzatma`,
            balanceAfter: newBalance,
          },
        }),
      ]);
    } else {
      await this.prisma.user.updateMany({
        where: { id: { in: validIds } },
        data: { status: action === 'suspend' ? 'DISABLED' : 'ACTIVE' },
      });
    }

    return { affected: validIds.length };
  }

  async getPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true, durationDays: true, maxConnections: true, creditCost: true },
      orderBy: { creditCost: 'asc' },
    });
  }

  async resetUserPassword(resellerId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, resellerId, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const rawPassword = randomBytes(4).toString('hex');
    const hashed = await bcrypt.hash(rawPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { password: rawPassword };
  }

  async getUserPlaylists(resellerId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, resellerId, deletedAt: null } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    return this.prisma.userPlaylist.findMany({
      where: { userId },
      select: {
        id: true, name: true, type: true, isActive: true,
        expiresAt: true, accessCount: true, lastAccessed: true, token: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
