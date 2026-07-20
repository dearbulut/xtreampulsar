import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SubtitleService } from './subtitle.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('subtitles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SubtitleController {
  constructor(private readonly service: SubtitleService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() body: { enabled?: boolean; apiKey?: string; username?: string; password?: string }) {
    return this.service.updateConfig(body);
  }

  @Get('search')
  search(@Query('query') query: string, @Query('languages') languages?: string) {
    return this.service.search(query, languages ?? 'en');
  }

  /** Aranan terimle eşleşen kütüphane filmleri (ekleme hedefi seçmek için). */
  @Get('match')
  match(@Query('query') query: string) {
    return this.service.matchLibrary(query ?? '');
  }

  /** Seçilen altyazıyı belirli bir filme ekle. */
  @Post('attach')
  attach(@Body() body: { streamId?: string; fileId?: number; language?: string; label?: string }) {
    return this.service.attach(body);
  }

  @Get('stream/:streamId')
  listAttached(@Param('streamId') streamId: string) {
    return this.service.listAttached(streamId);
  }

  @Delete('attached/:id')
  removeAttached(@Param('id') id: string) {
    return this.service.removeAttached(id);
  }

  @Get('download/:fileId')
  async download(@Param('fileId') fileId: string, @Res() res: Response): Promise<void> {
    const { filename, content } = await this.service.download(Number(fileId));
    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/["\r\n]/g, '')}"`);
    res.send(content);
  }
}
