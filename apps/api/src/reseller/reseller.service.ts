import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PaymentRequiredException } from '../common/exceptions/payment-required.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResellerDto } from './dto/create-reseller.dto';
import { UpdateResellerDto } from './dto/update-reseller.dto';

@Injectable()
export class ResellerService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.reseller.findMany({
      where: { deletedAt: null },
      select: {
        id: true, username: true, email: true, credits: true,
        tier: true, isActive: true, parentId: true, createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
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
    return this.prisma.reseller.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashed,
        credits: dto.credits ?? 0,
        tier: (dto.tier ?? 'BASIC') as 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM',
        ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
      },
      select: { id: true, username: true, email: true, credits: true, tier: true, createdAt: true },
    });
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

  async getCreditHistory(id: string, page = 1, limit = 20) {
    await this.findById(id);
    const [items, total] = await Promise.all([
      this.prisma.resellerCreditLog.findMany({
        where: { resellerId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.resellerCreditLog.count({ where: { resellerId: id } }),
    ]);
    return { items, total, page, limit };
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
}
