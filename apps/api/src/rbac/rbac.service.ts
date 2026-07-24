import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG, ALL_PERMISSION_KEYS } from './permissions.catalog';

export interface EffectivePermissions {
  isAdmin: boolean;
  isReseller: boolean;
  isBanned: boolean;
  permissions: string[];
}

interface GroupInput {
  name?: string;
  description?: string | null;
  isAdmin?: boolean;
  isReseller?: boolean;
  isBanned?: boolean;
  permissions?: string[];
}

const CACHE_TTL_MS = 15_000;

@Injectable()
export class RbacService {
  private cache = new Map<string, { value: EffectivePermissions; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return PERMISSION_CATALOG;
  }

  listGroups() {
    return this.prisma.adminGroup.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async getGroup(id: string) {
    const g = await this.prisma.adminGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grup bulunamadı');
    return g;
  }

  private sanitizePerms(perms?: string[]): string[] {
    if (!perms) return [];
    return [...new Set(perms.filter((p) => ALL_PERMISSION_KEYS.includes(p)))];
  }

  async createGroup(dto: GroupInput) {
    if (!dto.name || !dto.name.trim()) throw new BadRequestException('Grup adı gerekli');
    return this.prisma.adminGroup.create({
      data: {
        name: dto.name.trim(),
        description: dto.description ?? null,
        isAdmin: !!dto.isAdmin,
        isReseller: !!dto.isReseller,
        isBanned: !!dto.isBanned,
        permissions: this.sanitizePerms(dto.permissions),
      },
    });
  }

  async updateGroup(id: string, dto: GroupInput) {
    const g = await this.getGroup(id);
    const data: Record<string, unknown> = {};
    // Sistem gruplarinin adi/bayrsklari kilitli; sadece izinleri duzenlenebilir.
    if (!g.isSystem) {
      if (dto.name !== undefined) data.name = dto.name.trim();
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.isAdmin !== undefined) data.isAdmin = dto.isAdmin;
      if (dto.isReseller !== undefined) data.isReseller = dto.isReseller;
      if (dto.isBanned !== undefined) data.isBanned = dto.isBanned;
    }
    if (dto.permissions !== undefined) data.permissions = this.sanitizePerms(dto.permissions);
    const updated = await this.prisma.adminGroup.update({ where: { id }, data });
    this.cache.clear();
    return updated;
  }

  async deleteGroup(id: string) {
    const g = await this.getGroup(id);
    if (g.isSystem) throw new ForbiddenException('Sistem grubu silinemez');
    const count = await this.prisma.user.count({ where: { adminGroupId: id } });
    if (count > 0) throw new BadRequestException(`Bu grupta ${count} hesap var; önce taşıyın`);
    await this.prisma.adminGroup.delete({ where: { id } });
    this.cache.clear();
    return { success: true };
  }

  /** Kullanicinin etkin izinlerini (grup + rol fallback) cache'li dondurur. */
  async getEffectivePermissions(userId: string, role: string): Promise<EffectivePermissions> {
    const cached = this.cache.get(userId);
    const now = Date.now();
    if (cached && cached.expires > now) return cached.value;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { adminGroupId: true, adminGroup: { select: { isAdmin: true, isReseller: true, isBanned: true, permissions: true } } },
    });

    let value: EffectivePermissions;
    const group = user?.adminGroup as { isAdmin: boolean; isReseller: boolean; isBanned: boolean; permissions: string[] } | null | undefined;
    if (group) {
      value = {
        isAdmin: group.isAdmin,
        isReseller: group.isReseller,
        isBanned: group.isBanned,
        permissions: group.isAdmin ? ALL_PERMISSION_KEYS : group.permissions,
      };
    } else {
      // Grup yoksa mevcut rol bazli davranis korunur (geri uyumluluk).
      value = {
        isAdmin: role === 'ADMIN',
        isReseller: role === 'RESELLER',
        isBanned: false,
        permissions: role === 'ADMIN' ? ALL_PERMISSION_KEYS : [],
      };
    }
    this.cache.set(userId, { value, expires: now + CACHE_TTL_MS });
    return value;
  }

  async hasPermission(userId: string, role: string, key: string): Promise<boolean> {
    const eff = await this.getEffectivePermissions(userId, role);
    if (eff.isBanned) return false;
    if (eff.isAdmin) return true;
    return eff.permissions.includes(key);
  }
}
