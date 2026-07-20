import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ActivationService } from './activation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('activation-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ActivationController {
  constructor(private readonly service: ActivationService) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list({ status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Post('generate')
  generate(@Body() body: { count: number; durationDays: number; maxConnections?: number; note?: string }) {
    return this.service.generate(body.count, body.durationDays, body.maxConnections, body.note);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.service.disable(id);
  }
}
