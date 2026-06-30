import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { EpgService } from './epg.service';
import { CreateEpgSourceDto } from './dto/create-epg-source.dto';
import { UpdateEpgSourceDto } from './dto/update-epg-source.dto';
import { CreateEpgMappingDto } from './dto/create-epg-mapping.dto';
import { MassAssignEpgDto } from './dto/mass-assign-epg.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('epg')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EpgController {
  constructor(private readonly epgService: EpgService) {}

  // ─── Sources ──────────────────────────────────────────────────────────────

  @Get('sources')
  findAllSources() {
    return this.epgService.findAllSources();
  }

  @Get('sources/:id')
  findSource(@Param('id') id: string) {
    return this.epgService.findSourceById(id);
  }

  @Post('sources')
  createSource(@Body() dto: CreateEpgSourceDto) {
    return this.epgService.create(dto);
  }

  @Patch('sources/:id')
  updateSource(@Param('id') id: string, @Body() dto: UpdateEpgSourceDto) {
    return this.epgService.update(id, dto);
  }

  @Delete('sources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSource(@Param('id') id: string): Promise<void> {
    await this.epgService.remove(id);
  }

  @Post('sources/parse-all')
  triggerParseAll() {
    return this.epgService.triggerParseAll();
  }

  @Post('sources/:id/parse')
  triggerParse(@Param('id') id: string) {
    return this.epgService.triggerParse(id);
  }

  @Get('sources/:id/channels')
  findChannels(@Param('id') id: string, @Query('search') search?: string) {
    return this.epgService.findChannels(id, search);
  }

  // ─── Mass assign (background job) ────────────────────────────────────────

  @Post('mass-assign')
  startMassAssign(@Body() dto: MassAssignEpgDto) {
    return this.epgService.startMassAssign(dto.epgSourceId, dto.minSimilarity, dto.stripPrefixes);
  }

  @Get('mass-assign/:jobId/status')
  getMassAssignStatus(@Param('jobId') jobId: string) {
    const job = this.epgService.getMassAssignJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return { jobId, ...job };
  }

  // ─── Mappings ─────────────────────────────────────────────────────────────

  @Get('mappings')
  findMappings() {
    return this.epgService.findAllMappings();
  }

  @Post('mappings')
  createMapping(@Body() dto: CreateEpgMappingDto) {
    return this.epgService.createMapping(dto);
  }

  @Delete('mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMapping(@Param('id') id: string): Promise<void> {
    await this.epgService.deleteMapping(id);
  }

  @Get('now-playing')
  getNowPlaying(@Query('streamIds') streamIds?: string) {
    const ids = streamIds ? streamIds.split(',').filter(Boolean) : [];
    return this.epgService.getNowPlaying(ids);
  }

  @Get('guide')
  getGuide(
    @Query('channelIds') channelIds?: string,
    @Query('date') date?: string,
  ) {
    return this.epgService.getGuide(
      channelIds ? channelIds.split(',').filter(Boolean) : [],
      date ?? new Date().toISOString().slice(0, 10),
    );
  }
}
