import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ControlLicensesService } from './control-licenses.service';
import { ControlJwtGuard } from './control-jwt.guard';

@Controller('control/licenses')
@UseGuards(ControlJwtGuard)
export class ControlLicensesController {
  constructor(private readonly service: ControlLicensesService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.findAll(Number(page) || 1, Number(limit) || 20, customerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: { customerId: string; plan?: string; maxUsers?: number; maxServers?: number; trialEndsAt?: string; expiresAt?: string; serverDomain?: string }) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.update(id, dto as Parameters<typeof this.service.update>[1]);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  suspend(@Param('id') id: string) {
    return this.service.suspend(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
