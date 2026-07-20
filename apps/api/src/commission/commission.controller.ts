import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionController {
  constructor(private readonly service: CommissionService) {}

  // ── Reseller-facing ──
  @Get('me')
  @Roles('RESELLER')
  myReferral(@CurrentUser() user: JwtUser) {
    return this.service.myReferral(user.id);
  }

  // ── Admin ──
  @Get()
  @Roles('ADMIN')
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list({ status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Get('rate')
  @Roles('ADMIN')
  getRate() {
    return this.service.getRate();
  }

  @Patch('rate')
  @Roles('ADMIN')
  setRate(@Body('rate') rate: number) {
    return this.service.setRate(rate);
  }

  @Post(':id/paid')
  @Roles('ADMIN')
  markPaid(@Param('id') id: string) {
    return this.service.markPaid(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('reseller/:resellerId/referrer')
  @Roles('ADMIN')
  setReferrer(@Param('resellerId') resellerId: string, @Body('code') code: string) {
    return this.service.setReferrer(resellerId, code);
  }
}
