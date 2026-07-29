import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
  Logger,
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
import { BulkUpdateStreamsDto } from './dto/bulk-update-stream.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';

@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StreamController {
  private readonly logger = new Logger(StreamController.name);

  constructor(
    private readonly streamService: StreamService,
    private readonly workerService: StreamWorkerService,
    private readonly healthService: StreamHealthService,
    private readonly qualityService: StreamQualityService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── Static-path routes ───────────────────────────────────────────────────
  // These MUST be declared before the parametric `:id` routes below. NestJS
  // (Express) matches in declaration order, so a bare `@Get(':id')` placed above
  // would swallow single-segment paths like `health-summary` (treating them as an
  // id). Stream ids are cuid, not uuid, so ParseUUIDPipe cannot be used to
  // disambiguate — ordering is the fix.

  @Get()
  findAll(@Query() query: QueryStreamDto, @CurrentUser() user: JwtUser) {
    return this.streamService.findAllWithFilters(user.id, query);
  }

  @Post()
  @Roles('ADMIN')
  @RequirePermission('streams.create')
  create(@Body() dto: CreateStreamDto) {
    return this.streamService.create(dto);
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

  @Get('health/summary')
  @Roles('ADMIN')
  healthSummaryNew() {
    return this.healthService.getHealthSummary();
  }

  @Get('health-summary')
  healthSummary() {
    return this.healthService.getHealthSummary();
  }

  @Get('quality-summary')
  qualitySummary() {
    return this.qualityService.getQualitySummary();
  }

  @Patch('reorder')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('streams.edit')
  async reorderStreams(@Body() body: { streamIds: string[] }): Promise<void> {
    await this.streamService.reorderStreams(body.streamIds);
  }

  @Patch('bulk-move')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  bulkMoveCategory(@Body() body: { streamIds: string[]; categoryId: string }) {
    return this.streamService.bulkMoveCategory(body.streamIds, body.categoryId);
  }

  /**
   * Toplu duzenleme. Hedef ya `streamIds` ya da yayin listesindeki filtrenin
   * aynisi; ikincisi 14 bin kanali tek istekte donusturmek icin var.
   * `?dryRun=1` sadece kac kaydin etkilenecegini doner (onay ekrani icin).
   */
  @Patch('bulk-update')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  async bulkUpdate(@Body() dto: BulkUpdateStreamsDto, @Query('dryRun') dryRun?: string) {
    const dry = dryRun === '1' || dryRun === 'true';
    const result = await this.streamService.bulkUpdate(dto, dry);
    if (!dry && result.updated > 0) await this.reconcileWorkers();
    return result;
  }

  /**
   * Toplu duzenleme sonrasi: modu artik TRANSCODE/LOOP olmayan ama hala ffmpeg
   * surecleri calisan yayinlari durdurur. Calisan worker sayisi uzerinden
   * gidiyoruz (genelde bir avuc), etkilenen kume kac bin olursa olsun maliyet
   * ayni kaliyor.
   */
  private async reconcileWorkers(): Promise<void> {
    const running = this.workerService.runningStreamIds();
    if (running.length === 0) return;
    const stale = await this.prisma.stream.findMany({
      where: {
        id: { in: running },
        OR: [{ streamMode: { notIn: ['TRANSCODE', 'LOOP'] } }, { isActive: false }],
      },
      select: { id: true },
    });
    for (const s of stale) {
      await this.workerService.stopWorker(s.id).catch(() => {});
    }
    if (stale.length > 0) {
      this.logger.log(`bulk-update sonrasi ${stale.length} worker durduruldu`);
    }
  }

  // ─── Parametric `:id` routes ──────────────────────────────────────────────
  // Multi-segment `:id/...` routes first, then the bare `:id` handlers last.

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
      select: {
        id: true,
        primaryUrl: true,
        name: true,
        streamMode: true,
        externalId: true,
        workerStatus: true,
        streamUserAgent: true,
        httpHeaders: true,
        httpCookie: true,
      },
    });
    if (!stream) throw new NotFoundException('Stream not found');

    const token = randomUUID();
    // Onizleme proxy'si kaynaga giderken akisin KENDI upstream basliklarini
    // kullanmali; cogu IPTV kaynagi UA/cookie filtreler ve aksi halde 403 doner.
    await this.redis.setex(
      `preview:${token}`,
      300,
      JSON.stringify({
        primaryUrl: stream.primaryUrl,
        streamId: stream.id,
        streamUserAgent: stream.streamUserAgent,
        httpHeaders: stream.httpHeaders,
        httpCookie: stream.httpCookie,
      }),
    );

    // ── TRANSCODE: panelin KENDI HLS ciktisini onizle ─────────────────────────
    // Onceden burada da ham kaynak URL'i proxy'lenirdi. Iki sorun vardi:
    //   1. Kaynaga IKINCI bir upstream baglantisi acilirdi — TRANSCODE modunun
    //      tum amaci olan "tek baglanti, N izleyici" carpani bozulurdu.
    //   2. Ham MPEG-TS'i tarayici oynatamaz; hls.js manifest bekler, <video>
    //      0:00'da asili kalirken XHR sinirsiz indirmeye devam ederdi.
    // Worker zaten segmentleri uretiyor; onizleme de onlari okumali.
    if ((stream.streamMode ?? 'PROXY') === 'TRANSCODE') {
      const hlsUrl = await this.transcodePreviewUrl(stream.id, stream.workerStatus);
      if (hlsUrl) {
        return {
          token,
          previewProxyUrl: hlsUrl,
          hlsUrl: stream.primaryUrl,
          name: stream.name,
          streamMode: stream.streamMode,
          externalId: stream.externalId,
        };
      }
    }

    return {
      token,
      previewProxyUrl: `/api/v1/streams/preview/${token}`,
      hlsUrl: stream.primaryUrl,
      name: stream.name,
      streamMode: stream.streamMode,
      externalId: stream.externalId,
    };
  }

  /** TRANSCODE yayinin panel tarafindaki HLS manifestini dondurur; worker
   *  uyuyorsa uyandirip kisa sure bekler. Cikti hazir degilse null. */
  private async transcodePreviewUrl(
    streamId: string,
    workerStatus: string | null | undefined,
  ): Promise<string | null> {
    const base = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
    const dir = path.join(base, streamId);
    const master = path.join(dir, 'master.m3u8');
    const single = path.join(dir, 'index.m3u8');
    const ready = (): 'master.m3u8' | 'index.m3u8' | null => {
      if (fs.existsSync(master)) return 'master.m3u8';
      if (fs.existsSync(single)) return 'index.m3u8';
      return null;
    };

    if (!ready() && (workerStatus === 'IDLE' || workerStatus === 'STOPPED')) {
      try {
        await this.workerService.startWorker(streamId);
      } catch {
        return null;
      }
      for (let i = 0; i < 10 && !ready(); i++) {
        await new Promise<void>((r) => setTimeout(r, 500));
      }
    }

    const file = ready();
    return file ? `/hls/${streamId}/${file}` : null;
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.workerService.getWorkerStats(id);
  }

  @Get(':id/health')
  @Roles('ADMIN')
  getHealth(@Param('id') id: string, @Query('hours') hours?: string) {
    return this.healthService.getStreamHealth(id, hours ? parseInt(hours, 10) : 24);
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

  @Post(':id/analyze')
  @Roles('ADMIN', 'RESELLER')
  analyzeStream(@Param('id') id: string) {
    return this.qualityService.analyzeStream(id);
  }

  @Get(':id/tracks')
  tracks(@Param('id') id: string) {
    return this.qualityService.probeTracks(id);
  }

  @Put(':id/backup-urls')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('streams.edit')
  async updateBackupUrls(
    @Param('id') id: string,
    @Body('backupUrls') backupUrls: string[],
  ) {
    await this.streamService.updateBackupUrls(id, backupUrls ?? []);
    return { success: true };
  }

  @Post(':id/clone')
  @Roles('ADMIN')
  @RequirePermission('streams.create')
  cloneStream(@Param('id') id: string, @Body() body?: { name?: string; primaryUrl?: string }) {
    return this.streamService.cloneStream(id, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.streamService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  update(@Param('id') id: string, @Body() dto: UpdateStreamDto) {
    return this.streamService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('streams.delete')
  async remove(@Param('id') id: string): Promise<void> {
    await this.streamService.remove(id);
  }
}
