import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { AdminGuard } from '../admin/admin.guard';
import { CreateLicenseDto } from './dto/create-license.dto';
import { VerifyLicenseDto } from './dto/verify-license.dto';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { ExtendLicenseDto } from './dto/extend-license.dto';

@Controller('licenses')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  // ── Admin endpoints ──────────────────────────────────────────────────────

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateLicenseDto) {
    return this.licenseService.create(dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.licenseService.findAll();
  }

  @Get(':key')
  @UseGuards(AdminGuard)
  findOne(@Param('key') key: string) {
    return this.licenseService.findByKey(key);
  }

  @Get(':key/logs')
  @UseGuards(AdminGuard)
  getLogs(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.licenseService.getLogs(key, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':key/suspend')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  suspend(@Param('key') key: string) {
    return this.licenseService.suspend(key);
  }

  @Post(':key/reactivate')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  reactivate(@Param('key') key: string) {
    return this.licenseService.reactivate(key);
  }

  @Post(':key/revoke')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  revoke(@Param('key') key: string) {
    return this.licenseService.revoke(key);
  }

  @Patch(':key/extend')
  @UseGuards(AdminGuard)
  extend(@Param('key') key: string, @Body() dto: ExtendLicenseDto) {
    return this.licenseService.extend(key, dto);
  }

  // ── Panel endpoints (no admin auth) ─────────────────────────────────────

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyLicenseDto) {
    return this.licenseService.verify(dto);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(dto);
  }
}
