import { Controller, Get, Delete, Param, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
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

  @Delete('connections/:id')
  @Roles('ADMIN', 'RESELLER')
  @HttpCode(HttpStatus.OK)
  kickConnection(@Param('id') id: string) {
    return this.analyticsService.kickConnection(id);
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

  @Get('geo-connections')
  getGeoConnections() {
    return this.analyticsService.getGeoConnections();
  }

  @Get('revenue')
  getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('resellerId') resellerId?: string,
  ) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 180 * 24 * 60 * 60 * 1000);
    return this.analyticsService.getRevenueReport(start, end, resellerId);
  }
}
