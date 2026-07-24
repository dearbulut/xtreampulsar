import { Controller, Get, Put, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  getPublicConfig() {
    return this.settingsService.getPublicConfig();
  }

  @Get('credit-pricing')
  getCreditPricing() {
    return this.settingsService.getCreditPricing();
  }

  @Get('server-url')
  async getServerUrl() {
    return { url: await this.settingsService.getActiveServerUrl() };
  }

  @Put('server-urls')
  @UseGuards(JwtAuthGuard)
  async updateServerUrls(@Body() body: { urls: string[] }) {
    await this.settingsService.updateServerUrls(body.urls ?? []);
    return { success: true };
  }

  @Put('primary-url/:index')
  @UseGuards(JwtAuthGuard)
  async setPrimaryUrl(@Param('index', ParseIntPipe) index: number) {
    await this.settingsService.setPrimaryUrl(index);
    return { success: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('settings.edit')
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.settingsService.updateSettings(body as Parameters<SettingsService['updateSettings']>[0]);
  }
}
