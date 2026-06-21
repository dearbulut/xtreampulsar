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

  @Post('xtream/import')
  importXtream(@Body() dto: ImportXtreamDto) {
    return this.migrationService.importXtream(dto);
  }
}
