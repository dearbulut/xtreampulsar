import {
  Controller, Get, Post, Param, Body, Req, UseGuards, HttpCode, HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { LicenseSupportGuard } from './license-support.guard';
import { ControlTicketsService } from './control-tickets.service';

interface SupportRequest {
  license: { id: string };
  licenseCustomer: { id: string; name: string; email: string };
  headers: Record<string, string | undefined>;
  socket?: { remoteAddress?: string };
}

@Controller('support/tickets')
@UseGuards(LicenseSupportGuard)
export class ControlSupportController {
  constructor(private readonly tickets: ControlTicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: SupportRequest,
    @Body() dto: { subject: string; message: string; category?: string; priority?: string; panelVersion?: string },
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const serverIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined)
      ?? req.socket?.remoteAddress;
    const panelUrl = req.headers['origin'] ?? req.headers['referer'];

    return this.tickets.createFromPanel({
      customerId: req.licenseCustomer.id,
      licenseId: req.license.id,
      subject: dto.subject,
      message: dto.message,
      category: dto.category ?? 'GENERAL',
      priority: dto.priority ?? 'MEDIUM',
      panelVersion: dto.panelVersion,
      panelUrl,
      serverIp,
    });
  }

  @Get()
  findAll(@Req() req: SupportRequest) {
    return this.tickets.findByLicense(req.license.id);
  }

  @Get(':id')
  async findOne(@Req() req: SupportRequest, @Param('id') id: string) {
    const ticket = await this.tickets.findOneForLicense(id, req.license.id);
    if (!ticket) throw new ForbiddenException('Ticket not found');
    return ticket;
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async closeTicket(@Req() req: SupportRequest, @Param('id') id: string) {
    return this.tickets.closeForLicense(id, req.license.id);
  }
}
