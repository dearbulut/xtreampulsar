import {
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import { NotificationService } from '../notification/notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { activeConnectionWhere } from '../user/user.repository';

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2000;

interface WorkerState {
  process: ChildProcess;
  restarts: number;
  startedAt: Date;
  stopping: boolean;
  activeUrl: string;
  stderrTail: string[]; // FFmpeg'in son stderr satırları — çökme sebebini görmek için
  lastViewerAt: Date;   // son izleyici görülme anı — on-demand uyutma için
}

@Injectable()
export class StreamWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(StreamWorkerService.name);
  private readonly workers = new Map<string, WorkerState>();
  private readonly hlsOutputPath =
    process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
  private readonly ffmpegPath: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: EventsGateway,
    @Optional() private readonly notificationService?: NotificationService,
  ) {
    this.ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
    this.logger.log(`FFmpeg path configured: ${this.ffmpegPath}`);
  }

  async startWorker(streamId: string, overrideUrl?: string): Promise<void> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
    });
    if (!stream) throw new NotFoundException(`Stream ${streamId} not found`);

    if ((stream.streamMode ?? 'PROXY') === 'PROXY') {
      this.logger.log(`Stream ${streamId} PROXY modda — FFmpeg worker başlatılmıyor`);
      await this.prisma.stream
        .update({
          where: { id: streamId },
          data: { workerStatus: 'IDLE', ffmpegPid: null },
        })
        .catch(() => {});
      return;
    }

    if (this.workers.has(streamId)) {
      await this.stopWorker(streamId);
    }

    const activeUrl = overrideUrl ?? stream.primaryUrl;
    const outputDir = path.join(this.hlsOutputPath, streamId);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'index.m3u8');
    const segmentPattern = path.join(outputDir, 'seg%05d.ts');

    let args: string[];
    if ((stream.streamMode ?? 'PROXY') === 'LOOP') {
      // 24/7 sahte-canli kanal: kaynak listesini concat demuxer + sonsuz dongu ile
      // birlestir, uniform H.264/AAC'ye yeniden kodla (heterojen kaynaklar sorunsuz
      // birlessin) ve canli HLS uret. `-re` gercek-zaman hizinda okur.
      const rawSources = (stream.loopSources && stream.loopSources.length
        ? stream.loopSources
        : [stream.primaryUrl]
      ).filter((u): u is string => !!u);
      if (stream.loopShuffle) {
        for (let i = rawSources.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rawSources[i], rawSources[j]] = [rawSources[j], rawSources[i]];
        }
      }
      const listPath = path.join(outputDir, 'playlist.txt');
      const listContent =
        rawSources.map((u) => `file '${u.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
      fs.writeFileSync(listPath, listContent);
      args = [
        '-re',
        '-stream_loop', '-1',
        '-f', 'concat',
        '-safe', '0',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-i', listPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-g', '48',
        '-c:a', 'aac', '-ar', '44100', '-b:a', '128k',
        '-fflags', '+genpts',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '10',
        '-hls_flags', 'append_list+delete_segments+omit_endlist',
        '-hls_segment_filename', segmentPattern,
        outputFile,
      ];
    } else {
      args = [
        '-i', activeUrl,
        // Tum ses parcalarini koru: -map olmadan ffmpeg tek ses secer ve
        // cok-dilli/dublaj parcalari duserdi. -map 0:a? ile hepsini gecir
        // (? = ses yoksa hata verme). Ilk video + tum ses + (varsa) altyazi.
        '-map', '0:v:0?',
        '-map', '0:a?',
        '-map', '0:s?',
        '-c', 'copy',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '10',
        '-hls_flags', 'append_list',
        '-hls_segment_filename', segmentPattern,
        outputFile,
      ];
    }

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
      activeUrl,
      stderrTail: [],
      lastViewerAt: new Date(),
    };

    this.workers.set(streamId, state);

    // Tüm stderr'ı log'a basmak gürültülü (FFmpeg sürekli progress basar); son 20
    // satırı tut, çökme anında handleExit son satırları error ile gösterir.
    proc.stderr?.on('data', (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        state.stderrTail.push(t);
        if (state.stderrTail.length > 20) state.stderrTail.shift();
      }
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

    this.gateway?.emitStreamStatus(streamId, 'RUNNING');
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

    this.gateway?.emitStreamStatus(streamId, 'STOPPED');
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
      const tail = state.stderrTail.slice(-8).join(' | ');
      this.logger.error(
        `Stream ${streamId} crashed (exit ${code}), restarting (${restarts + 1}/${MAX_RESTARTS}). FFmpeg stderr: ${tail || '(boş)'}`,
      );

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { workerStatus: 'CRASHED', restartCount: restarts + 1 },
      });

      setTimeout(() => void this.startWorker(streamId), RESTART_DELAY_MS);
    } else {
      if (code !== 0 && restarts >= MAX_RESTARTS) {
        // Try failover to backup URL if not already using it
        const streamData = await this.prisma.stream.findUnique({
          where: { id: streamId },
          select: { backupUrl: true, backupUrls: true },
        });
        const backups = streamData?.backupUrls?.length
          ? streamData.backupUrls
          : (streamData?.backupUrl ? [streamData.backupUrl] : []);
        const nextBackup = backups.find((u) => u && u !== state.activeUrl);
        if (nextBackup) {
          this.logger.warn(`Switching to backup URL for stream ${streamId}: ${nextBackup}`);
          await this.prisma.stream.update({
            where: { id: streamId },
            data: { workerStatus: 'CRASHED', restartCount: 0 },
          });
          setTimeout(() => void this.startWorker(streamId, nextBackup), RESTART_DELAY_MS);
          return;
        }
      }

      const finalStatus = restarts >= MAX_RESTARTS ? 'CRASHED' : 'STOPPED';
      if (restarts >= MAX_RESTARTS) {
        this.logger.error(
          `Stream ${streamId} exceeded max restarts (${MAX_RESTARTS}) — marking CRASHED`,
        );
        const s = await this.prisma.stream.findUnique({
          where: { id: streamId },
          select: { name: true },
        });
        void this.notificationService?.notifyStreamDown(streamId, s?.name ?? streamId);
      }

      await this.prisma.stream.update({
        where: { id: streamId },
        data: { workerStatus: finalStatus, ffmpegPid: null },
      });

      this.gateway?.emitStreamStatus(streamId, finalStatus);
    }
  }

  /** On-demand uyutma: izleyici kalmayinca worker'i durdur + HLS ciktisini sil.
   *  Controller'daki auto-start guard'i (`!fs.existsSync(index.m3u8)` + workerStatus IDLE)
   *  bir sonraki istekte yayini otomatik uyandirir. */
  private async sleepWorker(streamId: string): Promise<void> {
    const state = this.workers.get(streamId);
    if (!state) return;
    state.stopping = true;
    state.process.kill('SIGTERM');
    this.workers.delete(streamId);

    const outputDir = path.join(this.hlsOutputPath, streamId);
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      /* dizin yoksa yok say */
    }

    await this.prisma.stream
      .update({ where: { id: streamId }, data: { workerStatus: 'IDLE', ffmpegPid: null } })
      .catch(() => {});

    this.gateway?.emitStreamStatus(streamId, 'IDLE');
    this.logger.log(
      `Stream ${streamId} izleyicisiz — uyutuldu (istek gelince otomatik uyanir)`,
    );
  }

  /** Her dakika: idle-sleep acikken izleyicisi 0 olan TRANSCODE worker'lari
   *  ayarlanan sure kadar bos kaldiktan sonra uyutur (CPU/RAM tasarrufu). Ayar
   *  kapaliyken (default) hicbir sey yapmaz — dormant-safe. */
  @Cron(CronExpression.EVERY_MINUTE)
  async reapIdleWorkers(): Promise<void> {
    if (this.workers.size === 0) return;

    const settings = await this.prisma.settings
      .findUnique({
        where: { id: 'singleton' },
        select: { idleSleepEnabled: true, idleSleepMins: true },
      })
      .catch(() => null);
    if (!settings?.idleSleepEnabled) return;

    const idleMs = Math.max(1, settings.idleSleepMins ?? 10) * 60_000;
    const now = Date.now();

    for (const [streamId, state] of this.workers) {
      if (state.stopping) continue;
      const viewers = await this.prisma.connection
        .count({ where: { streamId, ...activeConnectionWhere() } })
        .catch(() => 1); // sayim hatasi olursa uyutma (guvenli taraf)
      if (viewers > 0) {
        state.lastViewerAt = new Date();
        continue;
      }
      if (now - state.lastViewerAt.getTime() >= idleMs) {
        await this.sleepWorker(streamId);
      }
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
