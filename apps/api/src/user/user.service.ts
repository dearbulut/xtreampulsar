import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';

@Injectable()
export class UserService {
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

  private async assertExists(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
