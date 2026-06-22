import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ServerGuardService } from './server-guard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('servers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ServerGuardController {
  constructor(private readonly serverGuardService: ServerGuardService) {}

  @Get(':id/guard')
  getGuard(@Param('id') id: string) {
    return this.serverGuardService.getGuard(id);
  }

  @Put(':id/guard')
  updateGuard(@Param('id') id: string, @Body() body: Parameters<ServerGuardService['updateGuard']>[1]) {
    return this.serverGuardService.updateGuard(id, body);
  }

  @Get(':id/guard/blocked-ips')
  getBlockedIps(@Param('id') id: string) {
    return this.serverGuardService.getBlockedIps(id);
  }

  @Post(':id/guard/unblock')
  unblockIp(@Param('id') id: string, @Body('ip') ip: string) {
    return this.serverGuardService.unblockIp(id, ip);
  }

  @Get(':id/guard/stats')
  getGuardStats(@Param('id') id: string) {
    return this.serverGuardService.getGuardStats(id);
  }
}
