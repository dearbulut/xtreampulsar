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
} from '@nestjs/common';
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
  ) {}

  @Get()
  findAll(@Query() query: QueryStreamDto, @CurrentUser() user: JwtUser) {
    return this.streamService.findAllWithFilters(user.id, query);
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

  @Get('health-summary')
  healthSummary() {
    return this.healthService.getHealthSummary();
  }

  @Get(':id/health')
  getHealth(@Param('id') id: string) {
    return this.healthService.getStreamHealth(id);
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

  @Post(':id/clone')
  @Roles('ADMIN')
  cloneStream(@Param('id') id: string, @Body() body?: { name?: string; primaryUrl?: string }) {
    return this.streamService.cloneStream(id, body);
  }
}
