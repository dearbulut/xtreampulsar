import { Controller, Post, Get, Param, UseGuards, Body } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Post(':id/enrich')
  async enrich(@Param('id') id: string, @Body('type') type?: 'VOD' | 'SERIES') {
    const ok = type === 'SERIES'
      ? await this.metadataService.enrichSeries(id)
      : await this.metadataService.enrichVod(id);
    return { success: ok, message: ok ? 'Meta veri başarıyla alındı' : 'Meta veri bulunamadı' };
  }

  @Post('enrich-all')
  enrichAll(@Body('max') max?: number) {
    return this.metadataService.enrichAllBatch(max ?? 100);
  }

  @Get(':id/metadata')
  getMetadata(@Param('id') id: string) {
    return this.metadataService.getMetadata(id);
  }
}
