import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Salt-okunur demo kilidi. DEMO_MODE=true iken tüm veri-değiştiren istekleri
 * (POST/PUT/PATCH/DELETE) reddeder — böylece herkese açık demo panelinde
 * yayınlanan giriş bilgileriyle kimse gerçek değişiklik yapamaz.
 *
 * İzin verilenler:
 *   - Tüm okuma istekleri (GET/HEAD/OPTIONS)
 *   - Kimlik doğrulama (login/logout/refresh/2FA) — kullanıcı yine de girebilsin
 *
 * DEMO_MODE ayarlı değilse guard tamamen şeffaftır (dormant, varsayılan kapalı).
 */
@Injectable()
export class DemoModeGuard implements CanActivate {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
  // login/logout/refresh/2fa gibi kimlik uçları demo modda da çalışmalı
  private static readonly AUTH_ALLOW_RE =
    /(\/auth(\/|$)|login|logout|refresh|2fa|two[-_]?factor)/i;

  /** nginx arkasında gerçek istemci IP'si (X-Real-IP → XFF-first → req.ip), ::ffff: temizlenir. */
  private static clientIp(req: Request): string | null {
    const strip = (v: string) => v.replace(/^::ffff:/, '').trim();
    const xr = req.headers['x-real-ip'];
    if (typeof xr === 'string' && xr) return strip(xr);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return strip(xff.split(',')[0]);
    return req.ip ? strip(req.ip) : null;
  }

  canActivate(context: ExecutionContext): boolean {
    if (process.env.DEMO_MODE !== 'true') return true;

    const req = context.switchToHttp().getRequest<Request>();

    // Bypass: DEMO_BYPASS_IPS listesindeki IP'ler demo modda da yazabilir
    // (yönetici kendi IP'sinden test eder; herkese açık demo yine kilitli kalır).
    const bypass = (process.env.DEMO_BYPASS_IPS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (bypass.length) {
      const ip = DemoModeGuard.clientIp(req);
      if (ip && bypass.includes(ip)) return true;
    }

    const method = (req.method ?? 'GET').toUpperCase();
    if (DemoModeGuard.SAFE_METHODS.has(method)) return true;

    const path = req.path ?? req.url ?? '';
    if (DemoModeGuard.AUTH_ALLOW_RE.test(path)) return true;

    throw new ForbiddenException(
      'This is a read-only demo. Changes are disabled. — Salt-okunur demo: değişiklik yapılamaz.',
    );
  }
}
