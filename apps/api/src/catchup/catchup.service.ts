import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const SEGMENT_SECS = 60;         // arsiv segment suresi
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 5000;

interface Archiver {
  proc: ChildProcess;
  restarts: number;
  stopping: boolean;
  stderrTail: string[];
}

/**
 * Catch-up / DVR — Increment 1: KAYIT altyapisi.
 * catchupEnabled her yayin icin kaynagi ffmpeg segment muxer ile diske arsivler
 * (%Y%m%d-%H%M%S.ts, -c copy). Retention cron eski segmentleri siler.
 * Oynatma + M3U catchup Increment 2'de.
 */
@Injectable()
export class CatchupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CatchupService.name);
  private readonly archiveDir = process.env.ARCHIVE_PATH ?? '/data/archive';
  private readonly ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
  private readonly archivers = new Map<string, Archiver>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    fs.mkdirSync(this.archiveDir, { recursive: true });
    await this.reconcile().catch((e) => this.logger.error(`init reconcile: ${(e as Error).message}`));
  }

  onModuleDestroy(): void {
    for (const [, a] of this.archivers) {
      a.stopping = true;
      try { a.proc.kill('SIGTERM'); } catch { /* */ }
    }
  }

  streamDir(streamId: string): string {
    return path.join(this.archiveDir, streamId);
  }

  private startArchiver(streamId: string, source: string): void {
    if (this.archivers.has(streamId)) return;
    const dir = this.streamDir(streamId);
    fs.mkdirSync(dir, { recursive: true });
    const pattern = path.join(dir, '%Y%m%d-%H%M%S.ts');
    const args = [
      '-nostdin', '-hide_banner', '-loglevel', 'warning',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
      '-i', source,
      '-c', 'copy',
      '-map', '0',
      '-f', 'segment',
      '-segment_time', String(SEGMENT_SECS),
      '-segment_format', 'mpegts',
      '-strftime', '1',
      '-reset_timestamps', '1',
      pattern,
    ];
    const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const state: Archiver = { proc, restarts: 0, stopping: false, stderrTail: [] };
    this.archivers.set(streamId, state);
    proc.stderr?.on('data', (b: Buffer) => {
      for (const l of b.toString().split(/\r?\n/)) { const t = l.trim(); if (t) { state.stderrTail.push(t); if (state.stderrTail.length > 15) state.stderrTail.shift(); } }
    });
    proc.on('exit', (code) => { void this.onExit(streamId, code, source); });
    this.logger.log(`Catch-up kaydi basladi: ${streamId}`);
  }

  private stopArchiver(streamId: string): void {
    const a = this.archivers.get(streamId);
    if (!a) return;
    a.stopping = true;
    try { a.proc.kill('SIGTERM'); } catch { /* */ }
    this.archivers.delete(streamId);
    this.logger.log(`Catch-up kaydi durdu: ${streamId}`);
  }

  private async onExit(streamId: string, code: number | null, source: string): Promise<void> {
    const a = this.archivers.get(streamId);
    this.archivers.delete(streamId);
    if (!a || a.stopping) return;
    // hala catchupEnabled ise yeniden basla (backoff)
    const stream = await this.prisma.stream.findUnique({ where: { id: streamId }, select: { catchupEnabled: true, primaryUrl: true, isActive: true } }).catch(() => null);
    if (!stream?.catchupEnabled || !stream.isActive) return;
    if (a.restarts >= MAX_RESTARTS) {
      this.logger.error(`Catch-up ${streamId} max restart asti (kod ${code}): ${a.stderrTail.slice(-3).join(' | ')}`);
      return;
    }
    setTimeout(() => {
      if (!this.archivers.has(streamId)) {
        this.startArchiver(streamId, stream.primaryUrl);
        const na = this.archivers.get(streamId);
        if (na) na.restarts = a.restarts + 1;
      }
    }, RESTART_DELAY_MS);
  }

  /** catchupEnabled yayinlarla calisan arsivleyicileri esitle (yeni basla, kapatilani durdur). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcile(): Promise<void> {
    const enabled = await this.prisma.stream.findMany({
      where: { catchupEnabled: true, isActive: true },
      select: { id: true, primaryUrl: true },
    }).catch(() => []);
    const wantIds = new Set(enabled.map((s) => s.id));
    for (const s of enabled) if (!this.archivers.has(s.id)) this.startArchiver(s.id, s.primaryUrl);
    for (const id of [...this.archivers.keys()]) if (!wantIds.has(id)) this.stopArchiver(id);
  }

  /** Eski segmentleri sil (catchupDays). Saatte bir. */
  @Cron(CronExpression.EVERY_HOUR)
  async retention(): Promise<void> {
    const streams = await this.prisma.stream.findMany({ where: { catchupEnabled: true }, select: { id: true, catchupDays: true } }).catch(() => []);
    for (const s of streams) {
      const dir = this.streamDir(s.id);
      const cutoff = Date.now() - Math.max(1, s.catchupDays) * 86_400_000;
      let files: string[] = [];
      try { files = fs.readdirSync(dir); } catch { continue; }
      for (const f of files) {
        const at = this.parseSegTime(f);
        if (at && at < cutoff) { try { fs.rmSync(path.join(dir, f), { force: true }); } catch { /* */ } }
      }
    }
  }

  /** %Y%m%d-%H%M%S.ts → epoch ms (UTC). */
  private parseSegTime(name: string): number | null {
    const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.ts$/.exec(name);
    if (!m) return null;
    const [, y, mo, d, h, mi, sec] = m;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  }

  /** UI/dogrulama: bir yayinin arsiv durumu. */
  async getArchiveInfo(streamId: string): Promise<{ recording: boolean; fileCount: number; sizeBytes: number; oldestAt: number | null; newestAt: number | null }> {
    const dir = this.streamDir(streamId);
    let files: string[] = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts')); } catch { /* */ }
    let sizeBytes = 0; let oldest: number | null = null; let newest: number | null = null;
    for (const f of files) {
      try { sizeBytes += fs.statSync(path.join(dir, f)).size; } catch { /* */ }
      const at = this.parseSegTime(f);
      if (at) { if (oldest === null || at < oldest) oldest = at; if (newest === null || at > newest) newest = at; }
    }
    return { recording: this.archivers.has(streamId), fileCount: files.length, sizeBytes, oldestAt: oldest, newestAt: newest };
  }
}
