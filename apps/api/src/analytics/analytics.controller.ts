import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboard();
  }

  @Get('connections')
  getLiveConnections(@Query() pagination: PaginationDto) {
    return this.analyticsService.getLiveConnections(pagination.page, pagination.limit);
  }

  @Get('bandwidth')
  getBandwidthChart() {
    return this.analyticsService.getBandwidthChart();
  }

  @Get('top-streams')
  getTopStreams(@Query('limit') limit?: string) {
    return this.analyticsService.getTopStreams(limit ? parseInt(limit, 10) : 10);
  }

  @Get('top-users')
  getTopUsers(@Query('limit') limit?: string) {
    return this.analyticsService.getTopUsers(limit ? parseInt(limit, 10) : 10);
  }

  @Get('servers')
  getServerStats() {
    return this.analyticsService.getServerStats();
  }
}
