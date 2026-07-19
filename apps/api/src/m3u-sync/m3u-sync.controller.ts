import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { M3uSyncService } from './m3u-sync.service';
import { CreateM3uSourceDto, UpdateM3uSourceDto } from './dto/m3u-source.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('m3u-sources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class M3uSyncController {
  constructor(private readonly service: M3uSyncService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateM3uSourceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateM3uSourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/sync')
  syncNow(@Param('id') id: string) {
    return this.service.syncNow(id);
  }
}
