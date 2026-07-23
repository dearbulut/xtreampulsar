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

  canActivate(context: ExecutionContext): boolean {
    if (process.env.DEMO_MODE !== 'true') return true;

    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method ?? 'GET').toUpperCase();
    if (DemoModeGuard.SAFE_METHODS.has(method)) return true;

    const path = req.path ?? req.url ?? '';
    if (DemoModeGuard.AUTH_ALLOW_RE.test(path)) return true;

    throw new ForbiddenException(
      'This is a read-only demo. Changes are disabled. — Salt-okunur demo: değişiklik yapılamaz.',
    );
  }
}
