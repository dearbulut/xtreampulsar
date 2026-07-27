import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

interface DemoJwtPayload {
  sub?: string;
  username?: string;
  role?: string;
  type?: string;
}

/**
 * Salt-okunur demo kilidi. DEMO_MODE=true iken tum veri-degistiren istekleri
 * (POST/PUT/PATCH/DELETE) reddeder — boylece herkese acik demo panelinde
 * yayinlanan giris bilgileriyle kimse gercek degisiklik yapamaz.
 *
 * Izin verilenler:
 *   - Tum okuma istekleri (GET/HEAD/OPTIONS)
 *   - SADECE oturum acma/kapama/yenileme uclari (asagidaki AUTH_WRITE_ALLOW listesi).
 *     Dikkat: /auth/change-password, /auth/setup, /auth/2fa/* ve /auth/impersonate
 *     BILEREK bu listede degil — aksi halde demo ziyaretcisi yayinlanan admin
 *     parolasini degistirip herkesi kilitleyebilirdi.
 *
 * Bypass (yazma yetkisi):
 *   - DEMO_BYPASS_IPS  : virgulle ayrilmis IP listesi
 *   - DEMO_BYPASS_USERS: virgulle ayrilmis admin kullanici adlari. Token imzasi
 *     dogrulanir; sadece admin tipi token kabul edilir (reseller/client/2fa token'i
 *     asla bypass edemez). Isimler .env icinde tutulur, repoya girmez.
 *
 * DEMO_MODE ayarli degilse guard tamamen seffaftir (dormant, varsayilan kapali).
 */
@Injectable()
export class DemoModeGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  /** Demo modda da calismasi gereken TEK yazma uclari (tam yol, prefix'siz). */
  private static readonly AUTH_WRITE_ALLOW = new Set([
    '/auth/login',
    '/auth/logout',
    '/auth/refresh',
    '/auth/2fa/verify',
    '/auth/reseller/login',
    '/auth/reseller/refresh',
    '/auth/reseller/logout',
    '/auth/client/login',
    '/auth/client/refresh',
    '/auth/client/logout',
  ]);

  constructor(private readonly jwt: JwtService) {}

  private static list(raw: string | undefined): string[] {
    return (raw ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  /** nginx arkasinda gercek istemci IP'si (X-Real-IP -> XFF-first -> req.ip), ::ffff: temizlenir. */
  private static clientIp(req: Request): string | null {
    const strip = (v: string) => v.replace(/^::ffff:/, '').trim();
    const xr = req.headers['x-real-ip'];
    if (typeof xr === 'string' && xr) return strip(xr);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return strip(xff.split(',')[0]);
    return req.ip ? strip(req.ip) : null;
  }

  /** '/api/v1/auth/login/' -> '/auth/login' */
  private static normalizePath(req: Request): string {
    let p = (req.path ?? req.url ?? '').split('?')[0].toLowerCase();
    p = p.replace(/^\/api\/v\d+/, '');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }

  /** Imzasi dogrulanmis admin token'inin kullanici adi DEMO_BYPASS_USERS icinde mi? */
  private userMayWrite(req: Request): boolean {
    const allow = DemoModeGuard.list(process.env.DEMO_BYPASS_USERS).map((u) => u.toLowerCase());
    if (!allow.length) return false;

    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) return false;

    try {
      const payload = this.jwt.verify<DemoJwtPayload>(header.slice(7).trim());
      // reseller / client / 2fa_pending / 2fa_setup_pending token'lari asla bypass edemez
      if (payload.type) return false;
      if (payload.role !== 'ADMIN') return false;
      return typeof payload.username === 'string' && allow.includes(payload.username.toLowerCase());
    } catch {
      return false;
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (process.env.DEMO_MODE !== 'true') return true;
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request | undefined>();
    if (!req) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    if (DemoModeGuard.SAFE_METHODS.has(method)) return true;

    const path = DemoModeGuard.normalizePath(req);
    if (DemoModeGuard.AUTH_WRITE_ALLOW.has(path)) return true;

    // Bypass 1: guvenilen IP'ler (yonetici kendi IP'sinden test eder)
    const bypassIps = DemoModeGuard.list(process.env.DEMO_BYPASS_IPS);
    if (bypassIps.length) {
      const ip = DemoModeGuard.clientIp(req);
      if (ip && bypassIps.includes(ip)) return true;
    }

    // Bypass 2: gercek yonetici hesaplari (demo hesabi bu listede degildir)
    if (this.userMayWrite(req)) return true;

    throw new ForbiddenException(
      'This is a read-only demo. Changes are disabled. — Salt-okunur demo: degisiklik yapilamaz.',
    );
  }
}
