import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('blocked-ips')
  listBlockedIps(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.securityService.listBannedIps(
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 200) : 50,
    );
  }

  @Post('ban')
  banIp(
    @Body('ip') ip: string,
    @Body('reason') reason: string,
    @Body('durationMinutes') durationMinutes?: number,
    @CurrentUser() user?: JwtUser,
  ) {
    return this.securityService.banIp(ip, reason, durationMinutes, user?.username);
  }

  @Delete('unban/:ip')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbanIp(@Param('ip') ip: string): Promise<void> {
    await this.securityService.unbanIp(ip);
  }

  @Get('ip-info/:ip')
  getIpInfo(@Param('ip') ip: string) {
    return this.securityService.getIpInfo(ip);
  }

  @Get('geo-stats')
  getGeoStats() {
    return this.securityService.getGeoStats();
  }
}
