import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Get()
  list(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.list({ status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(
    @Body()
    body: { customerName?: string; customerEmail?: string; description?: string; amount?: number; currency?: string; notes?: string },
  ) {
    return this.service.create(body);
  }

  @Post('from-order/:orderId')
  fromOrder(@Param('orderId') orderId: string) {
    return this.service.createFromStoreOrder(orderId);
  }

  @Post(':id/paid')
  markPaid(@Param('id') id: string) {
    return this.service.setStatus(id, 'PAID');
  }

  @Post(':id/unpaid')
  markUnpaid(@Param('id') id: string) {
    return this.service.setStatus(id, 'UNPAID');
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.setStatus(id, 'CANCELLED');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
