import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

const MAX_CONCURRENT = 3;

interface Active {
  proc: ChildProcess;
  intent: 'run' | 'pause' | 'cancel';
  lastDbAt: number;
}

/**
 * Operator indirme yoneticisi — notr bir indirme araci (IDM mantigi).
 * aria2c ile cok-baglantili + resume; hangi URL girilecegi/kaynak yasalligi
 * paneli calistiran operatorun sorumlulugunda.
 */
@Injectable()
export class DownloadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DownloadService.name);
  private readonly mediaDir = process.env.MEDIA_PATH ?? '/data/media';
  private readonly active = new Map<string, Active>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: EventsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    fs.mkdirSync(this.mediaDir, { recursive: true });
    // Yeniden baslatmada yarim kalan indirmeleri kuyruga al (aria2 --continue devam eder).
    await this.prisma.downloadJob
      .updateMany({ where: { status: 'DOWNLOADING' }, data: { status: 'QUEUED' } })
      .catch(() => {});
    void this.pump();
  }

  onModuleDestroy(): void {
    for (const [, a] of this.active) {
      try { a.proc.kill('SIGTERM'); } catch { /* yok say */ }
    }
  }

  // ─── Yardimcilar ────────────────────────────────────────────────────────────
  private sanitize(name: string): string {
    return name.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 200) || `download_${Date.now()}`;
  }

  private guessName(url: string): string {
    try {
      const u = new URL(url);
      const base = decodeURIComponent(u.pathname.split('/').pop() ?? '');
      if (base && /\.\w{2,5}$/.test(base)) return this.sanitize(base);
    } catch { /* yok say */ }
    return `download_${Date.now()}.mp4`;
  }

  private parseUnit(v: string): number {
    const m = /([\d.]+)\s*([KMGT]?)i?B/i.exec(v.trim());
    if (!m) return 0;
    const mult: Record<string, number> = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
    return Math.round(parseFloat(m[1]) * (mult[m[2].toUpperCase()] ?? 1));
  }

  filePath(job: { id: string; filename: string }): string {
    return path.join(this.mediaDir, `${job.id}__${job.filename}`);
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  async list() {
    return this.prisma.downloadJob.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createJob(input: { url: string; filename?: string; categoryId?: string; connections?: number }) {
    const url = input.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) throw new BadRequestException('Gecerli bir http(s) URL girin');
    const job = await this.prisma.downloadJob.create({
      data: {
        url,
        filename: this.sanitize(input.filename?.trim() || this.guessName(url)),
        categoryId: input.categoryId || null,
        connections: Math.min(32, Math.max(1, input.connections ?? 16)),
        status: 'QUEUED',
      },
    });
    void this.pump();
    return job;
  }

  async pause(id: string) {
    const a = this.active.get(id);
    if (a) { a.intent = 'pause'; try { a.proc.kill('SIGTERM'); } catch { /* */ } }
    else await this.setStatus(id, 'PAUSED');
    return this.get(id);
  }

  async resume(id: string) {
    const job = await this.get(id);
    if (['PAUSED', 'FAILED', 'CANCELED'].includes(job.status)) {
      await this.prisma.downloadJob.update({ where: { id }, data: { status: 'QUEUED', error: null } });
      void this.pump();
    }
    return this.get(id);
  }

  async cancel(id: string) {
    const a = this.active.get(id);
    if (a) { a.intent = 'cancel'; try { a.proc.kill('SIGTERM'); } catch { /* */ } }
    else await this.setStatus(id, 'CANCELED');
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const job = await this.get(id);
    const a = this.active.get(id);
    if (a) { a.intent = 'cancel'; try { a.proc.kill('SIGTERM'); } catch { /* */ } }
    const fp = this.filePath(job);
    for (const f of [fp, `${fp}.aria2`]) { try { fs.rmSync(f, { force: true }); } catch { /* */ } }
    await this.prisma.downloadJob.delete({ where: { id } }).catch(() => {});
  }

  private async get(id: string) {
    const job = await this.prisma.downloadJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Indirme bulunamadi');
    return job;
  }

  private async setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    await this.prisma.downloadJob.update({ where: { id }, data: { status, ...extra } }).catch(() => {});
    this.gateway?.emitDownloadProgress?.({ id, status, ...extra });
  }

  // ─── Kuyruk & indirme ───────────────────────────────────────────────────────
  private async pump(): Promise<void> {
    if (this.active.size >= MAX_CONCURRENT) return;
    const next = await this.prisma.downloadJob
      .findMany({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, take: MAX_CONCURRENT })
      .catch(() => []);
    for (const job of next) {
      if (this.active.size >= MAX_CONCURRENT) break;
      if (this.active.has(job.id)) continue;
      this.startJob(job.id, job.url, job.filename, job.connections);
    }
  }

  private startJob(id: string, url: string, filename: string, conns: number): void {
    const out = `${id}__${filename}`;
    const args = [
      '-x', String(conns), '-s', String(conns), '-k', '1M',
      '--continue=true', '--auto-file-renaming=false', '--allow-overwrite=true',
      '--file-allocation=none', '--summary-interval=1', '--console-log-level=warn',
      '--max-tries=5', '--retry-wait=3',
      '-d', this.mediaDir, '-o', out, url,
    ];
    const proc = spawn('aria2c', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const state: Active = { proc, intent: 'run', lastDbAt: 0 };
    this.active.set(id, state);
    void this.setStatus(id, 'DOWNLOADING', { error: null });
    this.logger.log(`Indirme basladi: ${id} (${filename}, x${conns})`);

    const onData = (buf: Buffer) => { void this.parseProgress(id, buf.toString(), state); };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', (e) => this.logger.error(`aria2 spawn hata ${id}: ${e.message}`));
    proc.on('exit', (code) => { void this.onExit(id, code, filename); });
  }

  private async parseProgress(id: string, text: string, state: Active): Promise<void> {
    // aria2 ozet satiri: [#gid 8.0MiB/1.2GiB(0%) CN:16 DL:12MiB ETA:..]
    const m = /([\d.]+\s*[KMGT]?i?B)\/([\d.]+\s*[KMGT]?i?B)\((\d+)%\).*?DL:\s*([\d.]+\s*[KMGT]?i?B)/i.exec(text);
    if (!m) return;
    const now = Date.now();
    if (now - state.lastDbAt < 1500) return; // DB'yi bogma
    state.lastDbAt = now;
    const downloaded = this.parseUnit(m[1]);
    const total = this.parseUnit(m[2]);
    const speed = this.parseUnit(m[4]);
    await this.prisma.downloadJob
      .update({ where: { id }, data: { downloadedBytes: BigInt(downloaded), totalBytes: BigInt(total), speedBps: speed } })
      .catch(() => {});
    this.gateway?.emitDownloadProgress?.({ id, status: 'DOWNLOADING', downloadedBytes: downloaded, totalBytes: total, speedBps: speed });
  }

  private async onExit(id: string, code: number | null, filename: string): Promise<void> {
    const state = this.active.get(id);
    this.active.delete(id);
    const intent = state?.intent ?? 'run';

    if (intent === 'pause') {
      await this.setStatus(id, 'PAUSED', { speedBps: 0 });
    } else if (intent === 'cancel') {
      const fp = path.join(this.mediaDir, `${id}__${filename}`);
      for (const f of [fp, `${fp}.aria2`]) { try { fs.rmSync(f, { force: true }); } catch { /* */ } }
      await this.setStatus(id, 'CANCELED', { speedBps: 0 });
    } else if (code === 0) {
      const fp = path.join(this.mediaDir, `${id}__${filename}`);
      let size = 0;
      try { size = fs.statSync(fp).size; } catch { /* */ }
      await this.prisma.downloadJob
        .update({ where: { id }, data: { status: 'COMPLETED', speedBps: 0, downloadedBytes: BigInt(size), totalBytes: BigInt(size) } })
        .catch(() => {});
      this.gateway?.emitDownloadProgress?.({ id, status: 'COMPLETED' });
      this.logger.log(`Indirme tamamlandi: ${id}`);
    } else {
      await this.setStatus(id, 'FAILED', { speedBps: 0, error: `aria2 cikis kodu ${code}` });
      this.logger.warn(`Indirme basarisiz: ${id} (kod ${code})`);
    }
    void this.pump();
  }

  // ─── VOD olarak ekle ────────────────────────────────────────────────────────
  async addToVod(id: string): Promise<{ streamId: string }> {
    const job = await this.get(id);
    if (job.status !== 'COMPLETED') throw new BadRequestException('Once indirme tamamlanmali');
    if (!job.categoryId) throw new BadRequestException('Hedef kategori secili degil');
    const base = (process.env.SERVER_URL ?? 'http://localhost').replace(/\/+$/, '');
    const primaryUrl = `${base}/api/v1/media/${job.id}`;
    const name = job.filename.replace(/\.\w{2,5}$/, '');
    const stream = await this.prisma.stream.create({
      data: { name, primaryUrl, categoryId: job.categoryId, streamMode: 'PROXY' },
    });
    await this.prisma.downloadJob.update({ where: { id }, data: { createdStreamId: stream.id } }).catch(() => {});
    return { streamId: stream.id };
  }
}
