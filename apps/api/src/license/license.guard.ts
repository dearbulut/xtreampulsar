import { CanActivate, ExecutionContext, Injectable, ForbiddenException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { LicenseService } from './license.service';

const OPEN: RegExp[] = [
  /^\/player_api\.php/, /^\/panel_api\.php/, /^\/get\.php/, /^\/xmltv\.php/,
  /^\/live\//, /^\/movie\//, /^\/series\//, /^\/hls\//,
  /^\/stalker/, /^\/playlist\//,
  /^\/api\/v1\/license/, /^\/api\/v1\/health/, /^\/api\/v1\/auth/,
];

@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);
  constructor(private readonly licenseService: LicenseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const p = (req as any).path || req.url || '';
    if (OPEN.some((rx) => rx.test(p))) return true;
    const allowed = await this.licenseService.isAllowed();
    if (allowed) return true;
    if (process.env.LICENSE_ENFORCE === 'true') {
      throw new ForbiddenException('License expired or invalid. Renew your license to continue.');
    }
    this.logger.warn(`[LICENSE report-only] would block ${req.method} ${p}`);
    return true;
  }
}
