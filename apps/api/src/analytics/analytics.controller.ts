import { Controller, Get, Delete, Param, Query, HttpCode, HttpStatus, UseGuards, Post } from '@nestjs/common';
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

  @Get('bandwidth/stream/:id')
  getBandwidthByStream(@Param('id') id: string, @Query('hours') hours?: string) {
    return this.analyticsService.getBandwidthByStream(id, hours ? parseInt(hours, 10) : 24);
  }

  @Get('bandwidth/user/:id')
  getBandwidthByUser(@Param('id') id: string, @Query('hours') hours?: string) {
    return this.analyticsService.getBandwidthByUser(id, hours ? parseInt(hours, 10) : 24);
  }

  @Get('bandwidth/today')
  getTodayBandwidthTotal() {
    return this.analyticsService.getTodayBandwidthTotal();
  }

  @Get('connections-by-hour')
  getConnectionsByHour() {
    return this.analyticsService.getConnectionsByHour();
  }

  @Get('top-categories')
  getTopCategories(@Query('limit') limit?: string) {
    return this.analyticsService.getTopCategories(limit ? parseInt(limit, 10) : 10);
  }

  @Get('user-growth')
  getUserGrowth(@Query('days') days?: string) {
    return this.analyticsService.getUserGrowth(days ? parseInt(days, 10) : 30);
  }

  @Get('dashboard-stats')
  getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('connections-chart')
  getConnectionsChart(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    const clamped = [24, 48, 168].includes(h) ? h : 24;
    return this.analyticsService.getConnectionsChart(clamped);
  }

  @Get('recent-activity')
  getRecentActivity(@Query('limit') limit?: string) {
    return this.analyticsService.getRecentActivity(limit ? parseInt(limit, 10) : 20);
  }

  @Get('user-report')
  getUserReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy?: string,
  ) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 3600_000);
    const group = (['day', 'week', 'month'] as const).includes(groupBy as 'day') ? (groupBy as 'day' | 'week' | 'month') : 'day';
    return this.analyticsService.getUserReport(start, end, group);
  }
}
