import {
  Controller, Get, Patch, Post, Body, UseGuards,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhiteLabelService } from './white-label.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('white-label')
export class WhiteLabelController {
  constructor(private readonly whiteLabelService: WhiteLabelService) {}

  @Get('config')
  getConfig() {
    return this.whiteLabelService.getConfig();
  }

  @Patch('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateConfig(@Body() dto: Record<string, unknown>) {
    return this.whiteLabelService.updateConfig(dto);
  }

  @Post('upload-logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    // In production: upload to S3/CDN and return URL
    // For now: convert to base64 data URL
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return this.whiteLabelService.setLogoUrl(dataUrl);
  }

  @Get('preview')
  getPreview() {
    return this.whiteLabelService.getPreview();
  }
}
