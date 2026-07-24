import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from '../decorators/current-user.decorator';
import type { AuditAction } from '@xtreampulsar/database';

const AUDITED_RESOURCES = new Set([
  'users', 'streams', 'resellers', 'settings', 'bouquets',
  'packages', 'categories', 'servers', 'mag-devices', 'enigma2-devices',
  'backup', 'rbac', 'auth',
]);

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const { method, url } = req;

    const action = METHOD_TO_ACTION[method];
    if (!action) return next.handle();

    // Extract resource from URL: /api/v1/{resource}/{id?}
    const segments = url.split('?')[0].split('/').filter(Boolean);
    const v1Idx = segments.indexOf('v1');
    if (v1Idx === -1) return next.handle();

    const resource = segments[v1Idx + 1];
    if (!resource || !AUDITED_RESOURCES.has(resource)) return next.handle();

    const entityId = segments[v1Idx + 2] ?? undefined;
    const actorId = req.user?.id ?? undefined;
    const actorType = req.user?.role ?? undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ??
      undefined;

    return next.handle().pipe(
      tap(() => {
        void this.prisma.auditLog
          .create({
            data: {
              action,
              entityType: resource,
              entityId,
              actorId,
              actorType,
              ipAddress,
              userAgent: req.headers['user-agent'] ?? undefined,
            },
          })
          .catch((err: unknown) => {
            this.logger.error(`Audit log creation failed: ${String(err)}`);
          });
      }),
    );
  }
}
