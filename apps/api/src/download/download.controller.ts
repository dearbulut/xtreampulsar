import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
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

  @Get('config')
  getConfig() {
    return this.downloadService.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() dto: { downloadSpeedKbps?: number; downloadConcurrency?: number; downloadAutoVod?: boolean }) {
    return this.downloadService.updateConfig(dto);
  }

  @Get('disk')
  disk() {
    return this.downloadService.diskUsage();
  }

  @Post()
  create(@Body() dto: { url: string; filename?: string; categoryId?: string; connections?: number; autoVod?: boolean }) {
    return this.downloadService.createJob(dto);
  }

  @Post('batch')
  batch(@Body() dto: { text: string; categoryId?: string; connections?: number; autoVod?: boolean }) {
    return this.downloadService.batchCreate(dto);
  }

  @Post('retry-failed')
  retryFailed() {
    return this.downloadService.retryFailed();
  }

  @Post('clear-finished')
  clearFinished() {
    return this.downloadService.clearFinished();
  }

  @Post(':id/pause')
  pause(@Param('id') id: string) { return this.downloadService.pause(id); }

  @Post(':id/resume')
  resume(@Param('id') id: string) { return this.downloadService.resume(id); }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) { return this.downloadService.cancel(id); }

  @Post(':id/priority')
  priority(@Param('id') id: string) { return this.downloadService.bumpPriority(id); }

  @Post(':id/add-to-vod')
  addToVod(@Param('id') id: string) { return this.downloadService.addToVod(id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.downloadService.remove(id); }
}
