import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { JwtUser } from '../decorators/current-user.decorator';
import { RbacService } from '../../rbac/rbac.service';

/**
 * Opt-in izin guard'i. Sadece @RequirePermission ile isaretlenen endpoint'lerde devreye girer.
 * Grubu olmayan ADMIN kullanicilar tum izinlere sahip sayilir (geri uyumluluk).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    if (!req.user) throw new ForbiddenException('Kimlik doğrulama gerekli');

    const ok = await this.rbac.hasPermission(req.user.id, req.user.role, permission);
    if (!ok) throw new ForbiddenException(`Yetkiniz yok: ${permission}`);
    return true;
  }
}
