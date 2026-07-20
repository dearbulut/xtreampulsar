import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('monitor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MonitorController {
  constructor(private readonly service: MonitorService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() body: { enabled?: boolean; cpuAlertPct?: number; memAlertPct?: number; diskAlertPct?: number }) {
    return this.service.updateConfig(body);
  }

  @Post('check')
  check() {
    return this.service.checkAndAlert(true);
  }
}
