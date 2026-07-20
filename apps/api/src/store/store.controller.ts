import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StoreService } from './store.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('store')
export class StoreController {
  constructor(private readonly service: StoreService) {}

  // ── PUBLIC (misafir) ──────────────────────────────────────────────
  @Get('packages')
  packages() {
    return this.service.listPublicPackages();
  }

  @Post('orders')
  createOrder(
    @Body() body: { packageId?: string; contactEmail?: string; desiredUsername?: string; note?: string },
  ) {
    return this.service.createOrder(body);
  }

  // ── ADMIN ─────────────────────────────────────────────────────────
  @Get('orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listOrders(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listOrders({ status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Post('orders/:id/fulfill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  fulfill(@Param('id') id: string) {
    return this.service.fulfillOrder(id);
  }

  @Post('orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  setStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.setStatus(id, status);
  }
}
