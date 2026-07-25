import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { SyncProviderDto } from './dto/sync-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProviderController {
  constructor(private readonly service: ProviderService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.service.create(dto);
  }

  @Post('preview')
  preview(@Body() body: { url: string }) {
    return this.service.preview(body.url);
  }

  @Post(':id/verify')
  reverify(@Param('id') id: string) {
    return this.service.reverify(id);
  }

  @Get(':id/browse')
  browse(@Param('id') id: string) {
    return this.service.browse(id);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string, @Body() dto: SyncProviderDto) {
    return this.service.sync(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id/streams')
  purgeStreams(@Param('id') id: string) {
    return this.service.purgeStreams(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
