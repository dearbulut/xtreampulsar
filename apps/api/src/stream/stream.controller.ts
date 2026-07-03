import { randomUUID } from 'crypto';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { StreamService } from './stream.service';
import { StreamWorkerService } from './stream-worker.service';
import { StreamHealthService } from './stream-health.service';
import { StreamQualityService } from './stream-quality.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { QueryStreamDto } from './dto/query-stream.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreamController {
  constructor(
    private readonly streamService: StreamService,
    private readonly workerService: StreamWorkerService,
    private readonly healthService: StreamHealthService,
    private readonly qualityService: StreamQualityService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  findAll(@Query() query: QueryStreamDto, @CurrentUser() user: JwtUser) {
    return this.streamService.findAllWithFilters(user.id, query);
  }

  @Get(':id/now-playing')
  async getNowPlaying(@Param('id') id: string) {
    const now = new Date();
    const mapping = await this.prisma.ePGMapping.findFirst({ where: { streamId: id } });
    if (!mapping) return { current: null, next: null };

    const channel = await this.prisma.ePGChannel.findFirst({
      where: { epgSourceId: mapping.epgSourceId, channelId: mapping.epgChannelId },
      select: { id: true },
    });
    if (!channel) return { current: null, next: null };

    const upcoming = await this.prisma.ePGProgramme.findMany({
      where: { epgChannelId: channel.id, stop: { gt: now } },
      orderBy: { start: 'asc' },
      take: 2,
    });

    const first = upcoming[0] ?? null;
    const second = upcoming[1] ?? null;
    const current = first && first.start <= now ? first : null;
    const next = current ? second : first;

    const fmt = (p: NonNullable<typeof first>) => ({
      id: p.id,
      title: p.title,
      start: p.start.toISOString(),
      stop: p.stop.toISOString(),
      durationMin: Math.round((p.stop.getTime() - p.start.getTime()) / 60000),
    });

    return { current: current ? fmt(current) : null, next: next ? fmt(next) : null };
  }

  @Get(':id/preview-url')
  @Roles('ADMIN')
  async getPreviewUrl(@Param('id') id: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id },
      select: { id: true, primaryUrl: true, name: true, streamMode: true, externalId: true },
    });
    if (!stream) throw new NotFoundException('Stream not found');

    const token = randomUUID();
    await this.redis.setex(`preview:${token}`, 300, JSON.stringify({ primaryUrl: stream.primaryUrl, streamId: stream.id }));

    return {
      token,
      previewProxyUrl: `/api/v1/streams/preview/${token}`,
      hlsUrl: stream.primaryUrl,
      name: stream.name,
      streamMode: stream.streamMode,
      externalId: stream.externalId,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streamService.findById(id);
  }

  @Post()
  @Roles('ADMIN', 'RESELLER')
  create(@Body() dto: CreateStreamDto) {
    return this.streamService.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'RESELLER')
  update(@Param('id') id: string, @Body() dto: UpdateStreamDto) {
    return this.streamService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.streamService.remove(id);
  }

  @Post('reset-crashed')
  @Roles('ADMIN')
  async resetCrashed() {
    const result = await this.prisma.stream.updateMany({
      where: { workerStatus: 'CRASHED' },
      data: { workerStatus: 'IDLE', ffmpegPid: null },
    });
    return { reset: result.count };
  }

  @Post(':id/start')
  @Roles('ADMIN', 'RESELLER')
  async start(@Param('id') id: string) {
    await this.workerService.startWorker(id);
    const stream = await this.prisma.stream.findUnique({
      where: { id },
      select: { ffmpegPid: true },
    });
    return { status: 'started', pid: stream?.ffmpegPid ?? null };
  }

  @Post(':id/stop')
  @Roles('ADMIN', 'RESELLER')
  async stop(@Param('id') id: string) {
    await this.workerService.stopWorker(id);
    return { status: 'stopped' };
  }

  @Post(':id/restart')
  @Roles('ADMIN', 'RESELLER')
  async restart(@Param('id') id: string) {
    await this.workerService.restartWorker(id);
    return { message: `Stream ${id} worker restarted` };
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.workerService.getWorkerStats(id);
  }

  // Must be before :id/health to avoid route shadowing
  @Get('health/summary')
  @Roles('ADMIN')
  healthSummaryNew() {
    return this.healthService.getHealthSummary();
  }

  @Get('health-summary')
  healthSummary() {
    return this.healthService.getHealthSummary();
  }

  @Get(':id/health')
  @Roles('ADMIN')
  getHealth(@Param('id') id: string, @Query('hours') hours?: string) {
    return this.healthService.getStreamHealth(id, hours ? parseInt(hours, 10) : 24);
  }

  @Post(':id/health/check')
  @Roles('ADMIN')
  manualCheck(@Param('id') id: string) {
    return this.healthService.checkStream(id);
  }

  @Post(':id/probe')
  @Roles('ADMIN', 'RESELLER')
  probe(@Param('id') id: string) {
    return this.healthService.probeStream(id);
  }

  @Get('quality-summary')
  qualitySummary() {
    return this.qualityService.getQualitySummary();
  }

  @Post(':id/analyze')
  @Roles('ADMIN', 'RESELLER')
  analyzeStream(@Param('id') id: string) {
    return this.qualityService.analyzeStream(id);
  }

  @Put(':id/backup-urls')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateBackupUrls(
    @Param('id') id: string,
    @Body('backupUrls') backupUrls: string[],
  ) {
    await this.streamService.updateBackupUrls(id, backupUrls ?? []);
    return { success: true };
  }

  @Post(':id/clone')
  @Roles('ADMIN')
  cloneStream(@Param('id') id: string, @Body() body?: { name?: string; primaryUrl?: string }) {
    return this.streamService.cloneStream(id, body);
  }

  @Patch('reorder')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderStreams(@Body() body: { streamIds: string[] }): Promise<void> {
    await this.streamService.reorderStreams(body.streamIds);
  }

  @Patch('bulk-move')
  @Roles('ADMIN')
  bulkMoveCategory(@Body() body: { streamIds: string[]; categoryId: string }) {
    return this.streamService.bulkMoveCategory(body.streamIds, body.categoryId);
  }
}
