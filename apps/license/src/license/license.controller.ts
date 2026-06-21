import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { LicenseService } from './license.service';

class ValidateLicenseDto {
  key!: string;
  serverIp!: string;
}

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('validate')
  validate(@Body() dto: ValidateLicenseDto) {
    return this.licenseService.validate(dto.key, dto.serverIp);
  }

  @Get(':key/status')
  status(@Param('key') key: string) {
    return this.licenseService.getStatus(key);
  }
}
