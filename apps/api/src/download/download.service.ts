import {
  Injectable,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import { MetadataService } from '../metadata/metadata.service';

const execFileAsync = promisify(execFile);

interface Active {
  proc: ChildProcess;
  intent: 'run' | 'pause' | 'cancel';
  lastDbAt: number;
}

interface JobLike {
  id: string;
  filename: string;
  categoryId: string | null;
  createdStreamId: string | null;
}

/**
 * Operator indirme yoneticisi — notr bir indirme araci (IDM mantigi).
 * aria2c ile cok-baglantili + resume + kuyruk; hiz siniri, oto-VOD, oncelik.
 */
@Injectable()
export class DownloadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DownloadService.name);
  private readonly mediaDir = process.env.MEDIA_PATH ?? '/data/media';
  private readonly active = new Map<string, Active>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly gateway?: EventsGateway,
    @Optional() private readonly metadata?: MetadataService,
  ) {}

  async onModuleInit(): Promise<void> {
    fs.mkdirSync(this.mediaDir, { recursive: true });
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

  // ─── Config ─────────────────────────────────────────────────────────────────
  async getConfig() {
    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
      select: { downloadSpeedKbps: true, downloadConcurrency: true, downloadAutoVod: true },
    });
  }

  async updateConfig(dto: { downloadSpeedKbps?: number; downloadConcurrency?: number; downloadAutoVod?: boolean }) {
    const data: Record<string, unknown> = {};
    if (typeof dto.downloadSpeedKbps === 'number') data.downloadSpeedKbps = Math.max(0, Math.floor(dto.downloadSpeedKbps));
    if (typeof dto.downloadConcurrency === 'number') data.downloadConcurrency = Math.min(10, Math.max(1, Math.floor(dto.downloadConcurrency)));
    if (typeof dto.downloadAutoVod === 'boolean') data.downloadAutoVod = dto.downloadAutoVod;
    await this.prisma.settings.update({ where: { id: 'singleton' }, data }).catch(() => {});
    void this.pump();
    return this.getConfig();
  }

  private async cfg(): Promise<{ speed: number; concurrency: number; autoVod: boolean }> {
    const s = await this.prisma.settings
      .findUnique({ where: { id: 'singleton' }, select: { downloadSpeedKbps: true, downloadConcurrency: true, downloadAutoVod: true } })
      .catch(() => null);
    return { speed: s?.downloadSpeedKbps ?? 0, concurrency: s?.downloadConcurrency ?? 3, autoVod: s?.downloadAutoVod ?? false };
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

  private parseList(text: string): { url: string; name?: string }[] {
    const out: { url: string; name?: string }[] = [];
    let pendingName: string | undefined;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (/^#EXTINF/i.test(line)) {
        const comma = line.lastIndexOf(',');
        pendingName = comma >= 0 ? line.slice(comma + 1).trim() : undefined;
        continue;
      }
      if (line.startsWith('#')) continue;
      if (/^https?:\/\//i.test(line)) { out.push({ url: line, name: pendingName }); pendingName = undefined; }
    }
    return out;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  async list() {
    return this.prisma.downloadJob.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
  }

  async createJob(input: { url: string; filename?: string; categoryId?: string; connections?: number; autoVod?: boolean }) {
    const url = input.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) throw new BadRequestException('Gecerli bir http(s) URL girin');
    const { autoVod: defAuto } = await this.cfg();
    const job = await this.prisma.downloadJob.create({
      data: {
        url,
        filename: this.sanitize(input.filename?.trim() || this.guessName(url)),
        categoryId: input.categoryId || null,
        connections: Math.min(32, Math.max(1, input.connections ?? 16)),
        autoVod: input.autoVod ?? defAuto,
        status: 'QUEUED',
      },
    });
    void this.pump();
    return job;
  }

  async batchCreate(input: { text: string; categoryId?: string; connections?: number; autoVod?: boolean }) {
    const items = this.parseList(input.text ?? '');
    if (!items.length) throw new BadRequestException('Listede gecerli URL bulunamadi');
    const { autoVod: defAuto } = await this.cfg();
    for (const it of items) {
      await this.prisma.downloadJob.create({
        data: {
          url: it.url,
          filename: this.sanitize(it.name || this.guessName(it.url)),
          categoryId: input.categoryId || null,
          connections: Math.min(32, Math.max(1, input.connections ?? 16)),
          autoVod: input.autoVod ?? defAuto,
          status: 'QUEUED',
        },
      }).catch(() => {});
    }
    void this.pump();
    return { created: items.length };
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

  async bumpPriority(id: string) {
    const agg = await this.prisma.downloadJob.aggregate({ _max: { priority: true } });
    const top = (agg._max.priority ?? 0) + 1;
    await this.prisma.downloadJob.update({ where: { id }, data: { priority: top } }).catch(() => {});
    return this.get(id);
  }

  async retryFailed() {
    const r = await this.prisma.downloadJob.updateMany({ where: { status: 'FAILED' }, data: { status: 'QUEUED', error: null } });
    void this.pump();
    return { requeued: r.count };
  }

  async clearFinished() {
    const jobs = await this.prisma.downloadJob.findMany({ where: { status: { in: ['FAILED', 'CANCELED'] } } });
    for (const j of jobs) {
      const fp = this.filePath(j);
      for (const f of [fp, `${fp}.aria2`]) { try { fs.rmSync(f, { force: true }); } catch { /* */ } }
    }
    const r = await this.prisma.downloadJob.deleteMany({ where: { status: { in: ['FAILED', 'CANCELED'] } } });
    return { removed: r.count };
  }

  async diskUsage(): Promise<{ used: number; total: number; free: number }> {
    let used = 0;
    try {
      for (const f of fs.readdirSync(this.mediaDir)) {
        try { used += fs.statSync(path.join(this.mediaDir, f)).size; } catch { /* */ }
      }
    } catch { /* */ }
    let total = 0, free = 0;
    try {
      const st = fs.statfsSync(this.mediaDir);
      total = Number(st.blocks) * st.bsize;
      free = Number(st.bavail) * st.bsize;
    } catch { /* */ }
    return { used, total, free };
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
    const { concurrency, speed } = await this.cfg();
    if (this.active.size >= concurrency) return;
    const next = await this.prisma.downloadJob
      .findMany({ where: { status: 'QUEUED' }, orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }], take: concurrency })
      .catch(() => []);
    for (const job of next) {
      if (this.active.size >= concurrency) break;
      if (this.active.has(job.id)) continue;
      this.startJob(job.id, job.url, job.filename, job.connections, speed);
    }
  }

  private startJob(id: string, url: string, filename: string, conns: number, speedKbps: number): void {
    const out = `${id}__${filename}`;
    const args = [
      '-x', String(conns), '-s', String(conns), '-k', '1M',
      '--continue=true', '--auto-file-renaming=false', '--allow-overwrite=true',
      '--file-allocation=none', '--summary-interval=1', '--console-log-level=warn',
      '--max-tries=5', '--retry-wait=3',
    ];
    if (speedKbps > 0) args.push(`--max-download-limit=${speedKbps}K`);
    args.push('-d', this.mediaDir, '-o', out, url);

    const proc = spawn('aria2c', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const state: Active = { proc, intent: 'run', lastDbAt: 0 };
    this.active.set(id, state);
    void this.setStatus(id, 'DOWNLOADING', { error: null });
    this.logger.log(`Indirme basladi: ${id} (${filename}, x${conns}${speedKbps > 0 ? `, <=${speedKbps}KB/s` : ''})`);

    const onData = (buf: Buffer) => { void this.parseProgress(id, buf.toString(), state); };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', (e) => this.logger.error(`aria2 spawn hata ${id}: ${e.message}`));
    proc.on('exit', (code) => { void this.onExit(id, code, filename); });
  }

  private async parseProgress(id: string, text: string, state: Active): Promise<void> {
    const m = /([\d.]+\s*[KMGT]?i?B)\/([\d.]+\s*[KMGT]?i?B)\((\d+)%\).*?DL:\s*([\d.]+\s*[KMGT]?i?B)/i.exec(text);
    if (!m) return;
    const now = Date.now();
    if (now - state.lastDbAt < 1500) return;
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
      const job = await this.prisma.downloadJob.findUnique({ where: { id } }).catch(() => null);
      if (job?.autoVod && job.categoryId && !job.createdStreamId) {
        void this.makeVod(job).catch((e) => this.logger.warn(`oto-VOD hata ${id}: ${(e as Error).message}`));
      }
    } else {
      await this.setStatus(id, 'FAILED', { speedBps: 0, error: `aria2 cikis kodu ${code}` });
      this.logger.warn(`Indirme basarisiz: ${id} (kod ${code})`);
    }
    void this.pump();
  }

  // ─── VOD olarak ekle (+ ffprobe metadata + TMDB) ────────────────────────────
  private async probeFile(fp: string): Promise<{ durationSecs?: number; resolution?: string; videoCodec?: string; fps?: number }> {
    try {
      const { stdout } = await execFileAsync(
        process.env.FFPROBE_PATH ?? 'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', fp],
        { maxBuffer: 4 * 1024 * 1024 },
      );
      const j = JSON.parse(stdout) as { streams?: Array<Record<string, unknown>>; format?: { duration?: string } };
      const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
      const durationSecs = j.format?.duration ? Math.round(parseFloat(j.format.duration)) : undefined;
      let fps: number | undefined;
      const rate = v?.r_frame_rate as string | undefined;
      if (rate && /^\d+\/\d+$/.test(rate)) { const [a, b] = rate.split('/').map(Number); if (b) fps = Math.round((a / b) * 100) / 100; }
      const w = v?.width as number | undefined;
      const h = v?.height as number | undefined;
      return {
        durationSecs,
        resolution: w && h ? `${w}x${h}` : undefined,
        videoCodec: v?.codec_name as string | undefined,
        fps,
      };
    } catch { return {}; }
  }

  private async makeVod(job: JobLike): Promise<string> {
    if (!job.categoryId) throw new BadRequestException('Hedef kategori secili degil');
    const meta = await this.probeFile(this.filePath(job));
    const base = (process.env.SERVER_URL ?? 'http://localhost').replace(/\/+$/, '');
    const primaryUrl = `${base}/api/v1/media/${job.id}`;
    const name = job.filename.replace(/\.\w{2,5}$/, '');
    const stream = await this.prisma.stream.create({
      data: { name, primaryUrl, categoryId: job.categoryId, streamMode: 'PROXY', ...meta },
    });
    await this.prisma.downloadJob.update({ where: { id: job.id }, data: { createdStreamId: stream.id } }).catch(() => {});
    void this.metadata?.enrichVod(stream.id).catch(() => {}); // TMDB (poster/ozet) — anahtar varsa
    return stream.id;
  }

  async addToVod(id: string): Promise<{ streamId: string }> {
    const job = await this.get(id);
    if (job.status !== 'COMPLETED') throw new BadRequestException('Once indirme tamamlanmali');
    if (job.createdStreamId) return { streamId: job.createdStreamId };
    const streamId = await this.makeVod(job);
    return { streamId };
  }
}
