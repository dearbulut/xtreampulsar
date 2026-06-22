import { Controller, Get, Post, Delete, Param, Body, Res, UseGuards, HttpCode, HttpStatus, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('list')
  list() {
    return this.backupService.listLocalBackups();
  }

  @Get('download/:filename')
  async download(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const filePath = await this.backupService.getDownloadPath(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    return new StreamableFile(createReadStream(filePath));
  }

  @Post('create')
  create() {
    return this.backupService.createLocalBackup();
  }

  @Post('restore/:filename')
  restore(@Param('filename') filename: string) {
    return this.backupService.restoreBackup(filename);
  }

  @Delete(':filename')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('filename') filename: string): Promise<void> {
    await this.backupService.deleteBackup(filename);
  }

  @Post('upload-dropbox/:filename')
  uploadDropbox(
    @Param('filename') filename: string,
    @Body('apiKey') apiKey?: string,
  ) {
    return this.backupService.uploadToDropbox(filename, apiKey);
  }
}
