import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: { subject: string; message: string; category?: string; priority?: string }) {
    return this.service.createTicket(dto);
  }

  @Get('tickets')
  findAll() {
    return this.service.getTickets();
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.service.getTicket(id);
  }

  @Post('tickets/:id/close')
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string) {
    return this.service.closeTicket(id);
  }
}
