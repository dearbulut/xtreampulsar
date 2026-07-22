import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { DownloadService } from './download.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('downloads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get()
  list() {
    return this.downloadService.list();
  }

  @Post()
  create(@Body() dto: { url: string; filename?: string; categoryId?: string; connections?: number }) {
    return this.downloadService.createJob(dto);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) {
    return this.downloadService.pause(id);
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.downloadService.resume(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.downloadService.cancel(id);
  }

  @Post(':id/add-to-vod')
  addToVod(@Param('id') id: string) {
    return this.downloadService.addToVod(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.downloadService.remove(id);
  }
}
