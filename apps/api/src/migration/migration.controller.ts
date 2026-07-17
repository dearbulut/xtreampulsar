import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MigrationService } from './migration.service';
import { ImportM3uDto } from './dto/import-m3u.dto';
import { ImportXtreamDto } from './dto/import-xtream.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Get('jobs')
  findAllJobs() {
    return this.migrationService.findAllJobs();
  }

  @Get('jobs/:id')
  findJob(@Param('id') id: string) {
    return this.migrationService.findJob(id);
  }

  @Delete('jobs/:id')
  cancelJob(@Param('id') id: string) {
    return this.migrationService.cancelJob(id);
  }

  @Post('m3u/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  previewM3u(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.migrationService.previewM3u(file.buffer);
  }

  @Post('m3u/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  importM3u(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportM3uDto) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.migrationService.importM3u(file.buffer, dto);
  }

  @Post('m3u/preview-url')
  previewM3uUrl(@Body('url') url: string) {
    if (!url) throw new BadRequestException('url required');
    return this.migrationService.previewM3uFromUrl(url);
  }

  @Post('m3u/import-url')
  importM3uUrl(@Body() body: ImportM3uDto & { url: string }) {
    if (!body.url) throw new BadRequestException('url required');
    return this.migrationService.importM3uFromUrl(body.url, body);
  }

  @Post('xtream/import')
  importXtream(@Body() dto: ImportXtreamDto) {
    return this.migrationService.importXtream(dto);
  }

  @Post('fix-stream-types')
  fixStreamTypes(@Body('dryRun') dryRun?: boolean) {
    return this.migrationService.fixStreamTypes(dryRun ?? false);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  uploadDump(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.migrationService.uploadDump(file.buffer, file.originalname);
  }

  @Post('preview/:jobId')
  previewDump(@Param('jobId') jobId: string) {
    return this.migrationService.previewDump(jobId);
  }

  @Post('import/:jobId')
  importFromDump(
    @Param('jobId') jobId: string,
    @Body() options: {
      importStreams?: boolean;
      importCategories?: boolean;
      importUsers?: boolean;
      importResellers?: boolean;
      importPackages?: boolean;
      importBouquets?: boolean;
      importEpgMappings?: boolean;
      conflictMode?: 'SKIP' | 'OVERWRITE' | 'MERGE';
      defaultPassword?: string;
    },
  ) {
    const opts = {
      importStreams: options.importStreams ?? true,
      importCategories: options.importCategories ?? true,
      importUsers: options.importUsers ?? true,
      importResellers: options.importResellers ?? true,
      importPackages: options.importPackages ?? true,
      importBouquets: options.importBouquets ?? true,
      importEpgMappings: options.importEpgMappings ?? false,
      conflictMode: options.conflictMode ?? 'SKIP',
      defaultPassword: options.defaultPassword,
    };
    return this.migrationService.importFromDump(jobId, opts);
  }
}
