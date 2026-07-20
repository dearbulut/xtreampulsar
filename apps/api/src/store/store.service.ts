import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';

/**
 * Self-servis mağaza: operatör paketleri "isPublic" ile satışa açar, misafir
 * mağaza sayfasından sipariş bırakır (store_orders / PENDING). Admin siparişi
 * "karşıla" der → aktivasyon/hat mantığıyla gerçek bir abone hattı oluşturulur
 * ve kimlik bilgileri admin'e gösterilir (müşteriye iletmesi için). Ödeme
 * panel dışıdır (havale/kripto/manuel); kart verisi panelde tutulmaz.
 */
@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  /** Misafire açık satış paketleri. */
  async listPublicPackages() {
    return this.prisma.package.findMany({
      where: { isActive: true, isPublic: true },
      select: { id: true, name: true, durationDays: true, maxConnections: true, price: true, description: true },
      orderBy: { price: 'asc' },
    });
  }

  async createOrder(dto: { packageId?: string; contactEmail?: string; desiredUsername?: string; note?: string }) {
    const email = (dto.contactEmail ?? '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('Geçerli bir e-posta girin');
    }
    const pkg = await this.prisma.package.findFirst({
      where: { id: dto.packageId ?? '', isActive: true, isPublic: true },
    });
    if (!pkg) throw new BadRequestException('Paket bulunamadı veya satışta değil');

    const desired = (dto.desiredUsername ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32);

    const order = await this.prisma.storeOrder.create({
      data: {
        packageId: pkg.id,
        packageName: pkg.name,
        price: pkg.price,
        contactEmail: email,
        desiredUsername: desired || null,
        note: (dto.note ?? '').trim().slice(0, 500) || null,
      },
      select: { id: true, status: true },
    });
    this.logger.log(`Store order ${order.id}: ${pkg.name} (${email})`);
    return { id: order.id, status: order.status };
  }

  async listOrders(params: { status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) > 0 ? Number(params.page) : 1;
    const limit = Number(params.limit) > 0 ? Number(params.limit) : 100;
    const where = params.status ? { status: params.status } : {};
    const [items, total, pending] = await Promise.all([
      this.prisma.storeOrder.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.storeOrder.count({ where }),
      this.prisma.storeOrder.count({ where: { status: 'PENDING' } }),
    ]);
    return { items, total, page, limit, pending };
  }

  private genPassword(): string {
    const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 12 }, () => a[crypto.randomInt(0, a.length)]).join('');
  }

  private async uniqueUsername(base?: string): Promise<string> {
    const rand = () => {
      const a = 'abcdefghjkmnpqrstuvwxyz23456789';
      return Array.from({ length: 8 }, () => a[crypto.randomInt(0, a.length)]).join('');
    };
    for (let i = 0; i < 8; i++) {
      const cand = base && i === 0 ? base : base ? `${base}${crypto.randomInt(10, 99)}` : rand();
      const exists = await this.prisma.user.findUnique({ where: { username: cand } });
      if (!exists) return cand;
    }
    return rand();
  }

  /** Siparişi karşıla: paketten gerçek hat oluştur, kimlik bilgilerini döndür. */
  async fulfillOrder(id: string) {
    const order = await this.prisma.storeOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status === 'FULFILLED') throw new BadRequestException('Bu sipariş zaten karşılandı');
    if (order.status === 'CANCELLED') throw new BadRequestException('İptal edilmiş sipariş karşılanamaz');

    const pkg = await this.prisma.package.findUnique({ where: { id: order.packageId } });
    if (!pkg) throw new BadRequestException('Sipariş paketi artık mevcut değil');

    const username = await this.uniqueUsername(order.desiredUsername ?? undefined);
    const password = this.genPassword();
    const expiresAt = new Date(Date.now() + pkg.durationDays * 86_400_000).toISOString();

    const line = await this.userService.create({
      username,
      password,
      expiresAt,
      maxConnections: pkg.maxConnections,
      role: 'USER',
      packageId: pkg.id,
      notes: `[Mağaza] ${order.contactEmail}`,
    });

    const updated = await this.prisma.storeOrder.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        provisionedUserId: line.id,
        provisionedUsername: username,
        provisionedPassword: password,
      },
    });
    this.logger.log(`Store order ${id} fulfilled → line ${username}`);
    return updated;
  }

  async setStatus(id: string, status: string) {
    const allowed = ['PENDING', 'PAID', 'CANCELLED'];
    if (!allowed.includes(status)) throw new BadRequestException('Geçersiz durum');
    const order = await this.prisma.storeOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status === 'FULFILLED') throw new BadRequestException('Karşılanmış sipariş değiştirilemez');
    return this.prisma.storeOrder.update({ where: { id }, data: { status } });
  }
}
