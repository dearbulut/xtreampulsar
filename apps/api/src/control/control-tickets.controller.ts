import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ControlTicketsService } from './control-tickets.service';
import { ControlJwtGuard } from './control-jwt.guard';

@Controller('control/tickets')
@UseGuards(ControlJwtGuard)
export class ControlTicketsController {
  constructor(private readonly service: ControlTicketsService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.service.findAll(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: { customerId: string; subject: string; priority?: string; category?: string; message: string }) {
    return this.service.create(dto);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.OK)
  reply(@Param('id') id: string, @Body() dto: { content: string; isStaff?: boolean; authorName?: string }) {
    return this.service.reply(id, dto.content, dto.isStaff ?? true, dto.authorName);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string) {
    return this.service.close(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: { status?: string; priority?: string }) {
    return this.service.update(id, dto);
  }
}
