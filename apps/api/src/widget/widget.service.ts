import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StoreService } from '../store/store.service';
import { UserService } from '../user/user.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';

interface SubmitBody {
  email?: string;
  packageId?: string;
  username?: string;
  deviceId?: string;
}

// Prisma client Mac'te (arm64) generate edilemediğinden widget/widgetLead delegeleri
// tip olarak görünmüyor (beklenen TS2339). Runtime'da server client'ında mevcut.
type PrismaWithWidgets = PrismaService & {
  widget: {
    findMany: (a?: unknown) => Promise<Record<string, unknown>[]>;
    findUnique: (a: unknown) => Promise<Record<string, unknown> | null>;
    create: (a: unknown) => Promise<Record<string, unknown>>;
    update: (a: unknown) => Promise<Record<string, unknown>>;
    delete: (a: unknown) => Promise<Record<string, unknown>>;
  };
  widgetLead: {
    findMany: (a: unknown) => Promise<Record<string, unknown>[]>;
    count: (a: unknown) => Promise<number>;
    create: (a: unknown) => Promise<Record<string, unknown>>;
  };
};

@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);
  private readonly db: PrismaWithWidgets;

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly users: UserService,
  ) {
    this.db = prisma as unknown as PrismaWithWidgets;
  }

  private genKey(): string {
    return 'pub_' + crypto.randomBytes(12).toString('hex');
  }

  // ── ADMIN ──────────────────────────────────────────────────────────
  list() {
    return this.db.widget.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateWidgetDto) {
    return this.db.widget.create({
      data: {
        publicKey: this.genKey(),
        name: dto.name?.trim() || 'Widget',
        type: dto.type ?? 'STORE',
        enabled: dto.enabled ?? true,
        title: dto.title ?? null,
        subtitle: dto.subtitle ?? null,
        accentColor: dto.accentColor ?? '#6d28d9',
        trialPackageId: dto.trialPackageId ?? null,
        trialDurationDays: dto.trialDurationDays ?? 1,
        allowedPackageIds: dto.allowedPackageIds ?? [],
        successMessage: dto.successMessage ?? null,
        redirectUrl: dto.redirectUrl ?? null,
        perIpDailyLimit: dto.perIpDailyLimit ?? 5,
        oneTrialPerDevice: dto.oneTrialPerDevice ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateWidgetDto) {
    await this.ensure(id);
    const data: Record<string, unknown> = {};
    const set = <T>(k: string, v: T | undefined) => { if (v !== undefined) data[k] = v; };
    set('name', dto.name?.trim());
    set('type', dto.type);
    set('enabled', dto.enabled);
    set('title', dto.title);
    set('subtitle', dto.subtitle);
    set('accentColor', dto.accentColor);
    set('trialPackageId', dto.trialPackageId);
    set('trialDurationDays', dto.trialDurationDays);
    set('allowedPackageIds', dto.allowedPackageIds);
    set('successMessage', dto.successMessage);
    set('redirectUrl', dto.redirectUrl);
    set('perIpDailyLimit', dto.perIpDailyLimit);
    set('oneTrialPerDevice', dto.oneTrialPerDevice);
    return this.db.widget.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.ensure(id);
    await this.db.widget.delete({ where: { id } });
  }

  async leads(id: string) {
    await this.ensure(id);
    return this.db.widgetLead.findMany({ where: { widgetId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  private async ensure(id: string): Promise<Record<string, unknown>> {
    const w = await this.db.widget.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Widget bulunamadı');
    return w;
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────
  async publicConfig(key: string) {
    const w = await this.db.widget.findUnique({ where: { publicKey: key } });
    if (!w || w.enabled === false) throw new NotFoundException('Widget bulunamadı');
    const type = String(w.type);
    const out: Record<string, unknown> = {
      type,
      title: w.title ?? null,
      subtitle: w.subtitle ?? null,
      accentColor: w.accentColor ?? '#6d28d9',
      enabled: true,
    };
    if (type === 'STORE' || type === 'RENEWAL') {
      let packages = await this.store.listPublicPackages();
      const allowed = (w.allowedPackageIds as string[] | undefined) ?? [];
      if (allowed.length) packages = packages.filter((p) => allowed.includes(p.id));
      out.packages = packages;
    }
    if (type === 'TRIAL') out.trialDurationDays = w.trialDurationDays ?? 1;
    return out;
  }

  async submit(key: string, ip: string | null, body: SubmitBody) {
    const w = await this.db.widget.findUnique({ where: { publicKey: key } });
    if (!w || w.enabled === false) throw new NotFoundException('Widget bulunamadı');
    const type = String(w.type);
    const widgetId = String(w.id);

    // Anti-abuse: IP başına günlük limit.
    const limit = Number(w.perIpDailyLimit ?? 0);
    if (limit > 0 && ip) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const count = await this.db.widgetLead.count({ where: { widgetId, ip, createdAt: { gte: start } } });
      if (count >= limit) {
        await this.log(widgetId, type, ip, body.email, body.username, 'LIMITED', 'rate limit', body.deviceId);
        throw new ForbiddenException('Günlük limite ulaşıldı, lütfen daha sonra tekrar deneyin');
      }
    }

    // Trial: ayni cihaz (fingerprint) veya IP daha once basarili deneme aldiysa engelle.
    if (type === 'TRIAL' && w.oneTrialPerDevice !== false) {
      const or: Array<Record<string, unknown>> = [];
      if (body.deviceId) or.push({ deviceId: body.deviceId });
      if (ip) or.push({ ip });
      if (or.length) {
        const prior = await this.db.widgetLead.count({ where: { widgetId, type: 'TRIAL', result: 'OK', OR: or } });
        if (prior > 0) {
          await this.log(widgetId, type, ip, body.email, body.username, 'LIMITED', 'device already claimed', body.deviceId);
          throw new ForbiddenException('Bu cihaz zaten bir deneme aldı');
        }
      }
    }

    try {
      if (type === 'TRIAL') {
        const res = await this.users.createTrialUser({ durationDays: Number(w.trialDurationDays ?? 1) });
        await this.log(widgetId, type, ip, body.email, res.user.username, 'OK', null, body.deviceId);
        return {
          type,
          username: res.user.username,
          password: res.user.password,
          m3uUrl: res.m3uUrl,
          message: (w.successMessage as string | null) ?? null,
          redirectUrl: (w.redirectUrl as string | null) ?? null,
        };
      }

      if (type === 'STORE' || type === 'RENEWAL') {
        const email = (body.email ?? '').trim();
        const username = (body.username ?? '').trim();
        const renew = type === 'RENEWAL';
        const order = await this.store.createOrder({
          packageId: body.packageId,
          contactEmail: email,
          desiredUsername: renew ? username : undefined,
          note: renew ? `[YENİLEME] ${username}` : undefined,
        });
        await this.log(widgetId, type, ip, email, username || null, 'OK', order.id, body.deviceId);
        return {
          type,
          orderId: order.id,
          message: (w.successMessage as string | null) ?? null,
          redirectUrl: (w.redirectUrl as string | null) ?? null,
        };
      }

      throw new BadRequestException('Bilinmeyen widget tipi');
    } catch (e) {
      await this.log(widgetId, type, ip, body.email, body.username, 'ERROR', (e as Error).message, body.deviceId);
      throw e;
    }
  }

  private log(
    widgetId: string,
    type: string,
    ip: string | null,
    email?: string | null,
    username?: string | null,
    result = 'OK',
    message?: string | null,
    deviceId?: string | null,
  ) {
    return this.db.widgetLead
      .create({
        data: {
          widgetId,
          type,
          ip: ip ?? null,
          email: email ?? null,
          username: username ?? null,
          result,
          message: message ? message.slice(0, 300) : null,
          deviceId: deviceId ?? null,
        },
      })
      .catch(() => undefined);
  }
}
