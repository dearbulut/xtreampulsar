import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClientRequestsService } from './client-requests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('client-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ClientRequestsController {
  constructor(private readonly service: ClientRequestsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({ status, type, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status: 'OPEN' | 'RESOLVED' | 'REJECTED'; adminNote?: string }) {
    return this.service.updateStatus(id, body.status, body.adminNote);
  }

  @Post(':id/ai-suggest')
  aiSuggest(@Param('id') id: string) {
    return this.service.aiSuggest(id);
  }
}
