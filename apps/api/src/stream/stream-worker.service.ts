import {
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2000;

interface WorkerState {
  process: ChildProcess;
  restarts: number;
  startedAt: Date;
  stopping: boolean;
}

@Injectable()
export class StreamWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(StreamWorkerService.name);
  private readonly workers = new Map<string, WorkerState>();
  private readonly hlsOutputPath =
    process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
  private readonly ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  constructor(private readonly prisma: PrismaService) {}

  async startWorker(streamId: string): Promise<void> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
    });
    if (!stream) throw new NotFoundException(`Stream ${streamId} not found`);

    if (this.workers.has(streamId)) {
      await this.stopWorker(streamId);
    }

    const outputDir = path.join(this.hlsOutputPath, streamId);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'index.m3u8');
    const segmentPattern = path.join(outputDir, 'seg%05d.ts');
    const args = [
      '-i', stream.primaryUrl,
      '-c', 'copy',
      '-f', 'hls',
      '-hls_time', '4',
      '-hls_list_size', '10',
      '-hls_flags', 'append_list',
      '-hls_segment_filename', segmentPattern,
      outputFile,
    ];

    this.logger.log(`Starting worker for stream ${streamId}`);
    this.logger.log(`FFmpeg path: ${this.ffmpegPath}`);
    this.logger.log(`Output dir: ${outputDir}`);
    this.logger.log(`Stream URL: ${stream.primaryUrl}`);
    this.logger.log(`FFmpeg args: ${args.join(' ')}`);

    if (path.isAbsolute(this.ffmpegPath) && !fs.existsSync(this.ffmpegPath)) {
      this.logger.error(`FFmpeg not found at: ${this.ffmpegPath}`);
      throw new Error(`FFmpeg not found: ${this.ffmpegPath}`);
    }

    const proc = spawn(this.ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const state: WorkerState = {
      process: proc,
      restarts: stream.restartCount,
      startedAt: new Date(),
      stopping: false,
    };

    this.workers.set(streamId, state);

    proc.stderr?.on('data', (data: Buffer) => {
      this.logger.verbose(`[${streamId}] ${data.toString().trim()}`);
    });

    proc.on('error', (err) => {
      this.logger.error(`FFmpeg spawn error for ${streamId}: ${err.message}`);
    });

    proc.on('exit', (code) => {
      void this.handleExit(streamId, code);
    });

    await this.prisma.stream.update({
      where: { id: streamId },
      data: { ffmpegPid: proc.pid ?? null, workerStatus: 'RUNNING' },
    });

    this.logger.log(`Stream ${streamId} worker started (PID ${proc.pid})`);
  }

  async stopWorker(streamId: string): Promise<void> {
    const state = this.workers.get(streamId);
    if (!state) return;

    state.stopping = true;
    state.process.kill('SIGTERM');
    this.workers.delete(streamId);

    await this.prisma.stream.update({
      where: { id: streamId },
      data: { workerStatus: 'STOPPED', ffmpegPid: null },
    });

    this.logger.log(`Stream ${streamId} worker stopped`);
  }

  async restartWorker(streamId: string): Promise<void> {
    await this.stopWorker(streamId);

    await this.prisma.stream.update({
      where: { id: streamId },
      data: { restartCount: 0 },
    });

    await this.startWorker(streamId);
  }

  getWorkerStats(streamId: string) {
    const state = this.workers.get(streamId);
    if (!state) {
      return { running: false };
    }

    const uptimeMs = Date.now() - state.startedAt.getTime();
    return {
      running: true,
      pid: state.process.pid,
      startedAt: state.startedAt,
      uptimeMs,
      uptimeFormatted: this.formatUptime(uptimeMs),
      restarts: state.restarts,
    };
  }

  private async handleExit(streamId: string, code: number | null): Promise<void> {
    const state = this.workers.get(streamId);
    if (!state || state.stopping) return;

    this.workers.delete(streamId);

    const currentStream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: { restartCount: true },
    });
    const restarts = currentStream?.restartCount ?? state.restarts;

    if (code !== 0 && restarts < MAX_RESTARTS) {
      this.logger.warn(
        `Stream ${streamId} crashed (exit ${code}), restarting (${restarts + 1}/${MAX_RESTARTS})`,
      );

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { workerStatus: 'CRASHED', restartCount: restarts + 1 },
      });

      setTimeout(() => void this.startWorker(streamId), RESTART_DELAY_MS);
    } else {
      const finalStatus = restarts >= MAX_RESTARTS ? 'CRASHED' : 'STOPPED';
      if (restarts >= MAX_RESTARTS) {
        this.logger.error(
          `Stream ${streamId} exceeded max restarts (${MAX_RESTARTS}) — marking CRASHED`,
        );
      }

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { workerStatus: finalStatus, ffmpegPid: null },
      });
    }
  }

  private formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }

  async onModuleDestroy(): Promise<void> {
    const ids = [...this.workers.keys()];
    await Promise.allSettled(ids.map((id) => this.stopWorker(id)));
    this.logger.log(`Stopped ${ids.length} worker(s) on shutdown`);
  }
}
