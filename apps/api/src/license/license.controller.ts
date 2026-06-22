import { Controller, Get } from '@nestjs/common';
import { LicenseService } from './license.service';

@Controller('api/v1/license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  async getStatus() {
    const status = await this.licenseService.getStatus();
    return status ?? { valid: false, reason: 'License key not configured' };
  }

  @Get('refresh')
  async refresh() {
    return this.licenseService.verifyLicense();
  }
}
