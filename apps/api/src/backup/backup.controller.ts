import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
