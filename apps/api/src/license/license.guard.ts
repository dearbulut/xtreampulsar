import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { LicenseService } from './license.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private readonly licenseService: LicenseService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const valid = await this.licenseService.isValid();
    if (!valid) {
      const grace = await this.licenseService.isInGrace();
      if (!grace) {
        throw new ForbiddenException('License expired or invalid. Renew your license to continue.');
      }
    }
    return true;
  }
}
