import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';

/**
 * Xtream aktivasyon kodu modeli: kod = hazir bir abone hattidir.
 * username = password = code. Musteri kodu uygulamasina girer, yayinlar acilir.
 * "Kod uret" = toplu hat olustur. Mevcut hat altyapisini (bouquet, baglanti
 * limiti, Xtream auth) oldugu gibi kullanir; kod sadece username=password olan
 * normal bir hattir.
 */
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  /** Uzaktan kumanda/TV kutusunda kolay yazilabilen 10 haneli kod (karisik 0/O/1/l/i yok). */
  private genCode(): string {
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
  }

  async generate(opts: {
    count?: number;
    durationDays?: number;
    maxConnections?: number;
    packageId?: string;
    note?: string;
  }) {
    const n = Math.min(Math.max(Number(opts.count) || 1, 1), 100);

    let durationDays = opts.durationDays;
    let maxConnections = opts.maxConnections;
    const packageId = opts.packageId || undefined;

    if (packageId) {
      const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg) throw new BadRequestException('Paket bulunamadı');
      durationDays = durationDays ?? pkg.durationDays;
      maxConnections = maxConnections ?? pkg.maxConnections;
    }
    if (!durationDays || durationDays < 1) {
      throw new BadRequestException('Süre (gün) girin veya bir paket seçin');
    }

    const expiresAtIso = new Date(Date.now() + durationDays * 86_400_000).toISOString();
    const noteText = opts.note?.trim();
    const codes: string[] = [];

    for (let i = 0; i < n; i++) {
      let created = false;
      for (let attempt = 0; attempt < 6 && !created; attempt++) {
        const code = this.genCode();
        try {
          const line = await this.userService.create({
            username: code,
            password: code,
            expiresAt: expiresAtIso,
            maxConnections: maxConnections ?? 1,
            role: 'USER',
            notes: noteText ? `[Aktivasyon] ${noteText}` : '[Aktivasyon kodu]',
            ...(packageId ? { packageId } : {}),
          });
          await this.prisma.activationCode.create({
            data: {
              code,
              durationDays,
              maxConnections: maxConnections ?? null,
              note: noteText ?? null,
              packageId: packageId ?? null,
              userId: line.id,
            },
          });
          codes.push(code);
          created = true;
        } catch (err) {
          const msg = String((err as { message?: string })?.message ?? '');
          const dupe = msg.includes('already taken') || (err as { code?: string })?.code === 'P2002';
          if (dupe) continue; // kod çakıştı, yenisini dene
          throw err;
        }
      }
      if (!created) throw new BadRequestException('Benzersiz kod üretilemedi, tekrar deneyin');
    }

    this.logger.log(`Activation: ${codes.length} hat üretildi (+${durationDays}g)`);
    return { generated: codes.length, codes };
  }

  async list(params: { status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 100;
    const where = params.status ? { status: params.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.activationCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activationCode.count({ where }),
    ]);

    const userIds = rows.map((r) => r.userId).filter((v): v is string => !!v);
    const [users, activeGroups] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, status: true, expiresAt: true, maxConnections: true, deletedAt: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? this.prisma.connection.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds }, endedAt: null },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ userId: string; _count: { _all: number } }>),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const activeById = new Map(activeGroups.map((g) => [g.userId, g._count._all]));

    const items = rows.map((r) => {
      const u = r.userId ? byId.get(r.userId) : undefined;
      const now = new Date();
      const lineStatus = !u || u.deletedAt
        ? 'DELETED'
        : u.status !== 'ACTIVE'
          ? u.status
          : u.expiresAt < now
            ? 'EXPIRED'
            : 'ACTIVE';
      return {
        id: r.id,
        code: r.code,
        durationDays: r.durationDays,
        maxConnections: r.maxConnections ?? u?.maxConnections ?? null,
        status: r.status, // ACTIVE | DISABLED (kod kaydinin durumu)
        note: r.note,
        createdAt: r.createdAt,
        userId: r.userId,
        lineStatus, // bagli hattin gercek durumu
        expiresAt: u?.expiresAt ?? null,
        activeConnections: (r.userId ? activeById.get(r.userId) : 0) ?? 0,
      };
    });

    return { items, total, page, limit };
  }

  /** Kodu ve bagli hatti devre disi birak (yayin kesilir). */
  async disable(id: string) {
    const rec = await this.prisma.activationCode.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Kod bulunamadı');
    await this.prisma.activationCode.update({ where: { id }, data: { status: 'DISABLED' } });
    if (rec.userId) {
      await this.prisma.user.updateMany({
        where: { id: rec.userId, deletedAt: null },
        data: { status: 'DISABLED' },
      });
    }
    return { success: true, status: 'DISABLED' };
  }

  /** Kodu ve bagli hatti tekrar aktif et. */
  async enable(id: string) {
    const rec = await this.prisma.activationCode.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Kod bulunamadı');
    await this.prisma.activationCode.update({ where: { id }, data: { status: 'ACTIVE' } });
    if (rec.userId) {
      await this.prisma.user.updateMany({
        where: { id: rec.userId, deletedAt: null },
        data: { status: 'ACTIVE' },
      });
    }
    return { success: true, status: 'ACTIVE' };
  }
}
