import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ControlInvoicesService } from './control-invoices.service';
import { ControlJwtGuard } from './control-jwt.guard';

@Controller('control/invoices')
@UseGuards(ControlJwtGuard)
export class ControlInvoicesController {
  constructor(private readonly service: ControlInvoicesService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.service.findAll(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: { customerId: string; amount: number; currency?: string; plan?: string; period?: string; dueAt?: string }) {
    return this.service.create(dto);
  }

  @Post(':id/mark-paid')
  @HttpCode(HttpStatus.OK)
  markPaid(@Param('id') id: string, @Body() dto: { stripeId?: string }) {
    return this.service.markPaid(id, dto.stripeId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
