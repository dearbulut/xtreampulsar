import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResellerService } from '../reseller/reseller.service';

@Injectable()
export class ResellerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reseller: ResellerService,
  ) {}

  async me(resellerId: string) {
    const r = await this.prisma.reseller.findUnique({
      where: { id: resellerId },
      select: { id: true, username: true, email: true, credits: true, tier: true },
    });
    if (!r) throw new NotFoundException('Reseller not found');
    return r;
  }

  packages() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true, durationDays: true, maxConnections: true, creditCost: true },
      orderBy: { creditCost: 'asc' },
    });
  }

  users(resellerId: string, search?: string) {
    return this.reseller.getMyUsers(resellerId, 1, 100, search, undefined, undefined, 'desc', undefined);
  }

  private async resolveUserId(resellerId: string, username: string): Promise<string> {
    const u = await this.prisma.user.findFirst({
      where: { username, resellerId, deletedAt: null },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('Subscriber not found');
    return u.id;
  }

  createUser(
    resellerId: string,
    body: { username?: string; password?: string; packageId?: string; durationDays?: number; maxConnections?: number; notes?: string },
  ) {
    if (body.packageId) {
      return this.reseller.quickCreateUserWithPackage(resellerId, {
        username: body.username, password: body.password, packageId: body.packageId, notes: body.notes,
      });
    }
    return this.reseller.quickCreateUser(resellerId, {
      username: body.username, password: body.password,
      durationDays: body.durationDays ?? 30, maxConnections: body.maxConnections ?? 1, notes: body.notes,
    });
  }

  async getUser(resellerId: string, username: string) {
    return this.reseller.getMyUserDetail(resellerId, await this.resolveUserId(resellerId, username));
  }

  async extend(resellerId: string, username: string, days: number) {
    return this.reseller.extendUser(resellerId, await this.resolveUserId(resellerId, username), days);
  }

  async setStatus(resellerId: string, username: string, status: string) {
    return this.reseller.updateMyUser(resellerId, await this.resolveUserId(resellerId, username), { status });
  }

  async remove(resellerId: string, username: string) {
    await this.reseller.deleteMyUser(resellerId, await this.resolveUserId(resellerId, username));
    return { deleted: true };
  }
}
