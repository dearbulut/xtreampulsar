import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpgSourceDto } from './dto/create-epg-source.dto';
import { UpdateEpgSourceDto } from './dto/update-epg-source.dto';
import { CreateEpgMappingDto } from './dto/create-epg-mapping.dto';
import { EpgParserService } from './epg-parser.service';

const BATCH_SIZE = 500;

export interface MassAssignJobResult {
  status: 'processing' | 'done' | 'failed';
  startedAt: string;
  finishedAt?: string;
  total?: number;
  matched?: number;
  error?: string;
}

@Injectable()
export class EpgService {
  private readonly logger = new Logger(EpgService.name);
  private readonly jobs = new Map<string, MassAssignJobResult>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly parserService: EpgParserService,
  ) {}

  // ─── Sources ──────────────────────────────────────────────────────────────

  findAllSources() {
    return this.prisma.ePGSource.findMany({ orderBy: { name: 'asc' } });
  }

  async findSourceById(id: string) {
    const src = await this.prisma.ePGSource.findUnique({ where: { id } });
    if (!src) throw new NotFoundException(`EPGSource ${id} not found`);
    return src;
  }

  create(dto: CreateEpgSourceDto) {
    return this.prisma.ePGSource.create({ data: dto });
  }

  async update(id: string, dto: UpdateEpgSourceDto) {
    await this.findSourceById(id);
    return this.prisma.ePGSource.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findSourceById(id);
    await this.prisma.ePGSource.delete({ where: { id } });
  }

  async triggerParse(sourceId: string) {
    await this.findSourceById(sourceId);
    // Güvenli fire-and-forget: parseSourceById status'u (RUNNING/SUCCESS/FAILED)
    // yönetir; .catch ile unhandled promise rejection (process crash) önlenir.
    void this.parserService.parseSourceById(sourceId).catch((err) => {
      this.logger.error(`EPG parse failed (${sourceId}): ${(err as Error).message}`);
    });
    return { message: 'EPG parse triggered' };
  }

  async triggerParseAll() {
    const sources = await this.prisma.ePGSource.findMany({ where: { isActive: true } });
    if (!sources.length) return { total: 0, success: 0, failed: 0 };
    // SIRALI: aynı anda tek kaynak parse edilir (paralel yerine) — bellek baskısı
    // ve OOM riski azalır.
    let success = 0;
    for (const src of sources) {
      try {
        await this.parserService.parseSourceById(src.id);
        success++;
      } catch {
        // Hata parseSourceById içinde status=FAILED olarak kaydedildi.
      }
    }
    return { total: sources.length, success, failed: sources.length - success };
  }

  // ─── Channels ─────────────────────────────────────────────────────────────

  async findChannels(sourceId: string, search?: string) {
    await this.findSourceById(sourceId);
    return this.prisma.ePGChannel.findMany({
      where: {
        epgSourceId: sourceId,
        ...(search ? { displayName: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { displayName: 'asc' },
    });
  }

  // ─── Mappings ─────────────────────────────────────────────────────────────

  findAllMappings() {
    return this.prisma.ePGMapping.findMany({
      include: {
        stream: { select: { id: true, name: true } },
        epgSource: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMapping(dto: CreateEpgMappingDto) {
    return this.prisma.ePGMapping.upsert({
      where: { streamId_epgSourceId: { streamId: dto.streamId, epgSourceId: dto.epgSourceId } },
      create: { streamId: dto.streamId, epgSourceId: dto.epgSourceId, epgChannelId: dto.epgChannelId },
      update: { epgChannelId: dto.epgChannelId },
    });
  }

  async deleteMapping(id: string): Promise<void> {
    const m = await this.prisma.ePGMapping.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`EPGMapping ${id} not found`);
    await this.prisma.ePGMapping.delete({ where: { id } });
  }

  // ─── Mass assign (background job) ────────────────────────────────────────

  async startMassAssign(epgSourceId: string, minSimilarity = 0.6, stripPrefixes: string[] = []) {
    await this.findSourceById(epgSourceId);
    const jobId = randomUUID();
    this.jobs.set(jobId, { status: 'processing', startedAt: new Date().toISOString() });
    // Fire-and-forget — HTTP request returns immediately
    void this.runMassAssign(jobId, epgSourceId, minSimilarity, stripPrefixes);
    return { jobId, status: 'processing' as const };
  }

  getMassAssignJob(jobId: string): MassAssignJobResult | null {
    return this.jobs.get(jobId) ?? null;
  }

  private async runMassAssign(
    jobId: string,
    epgSourceId: string,
    minSimilarity: number,
    stripPrefixes: string[],
  ): Promise<void> {
    const job = this.jobs.get(jobId)!;

    try {
      const mkNormalize = (prefixes: string[]) => (name: string): string => {
        let s = name;
        for (const prefix of prefixes) {
          if (!prefix) continue;
          const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          s = s.replace(new RegExp(`^${escaped}`, 'i'), '');
        }
        return s.trim().toLowerCase();
      };
      const normalize = mkNormalize(stripPrefixes);

      // Load EPG channels once — typically much fewer than streams
      const rawChannels = await this.prisma.ePGChannel.findMany({
        where: { epgSourceId },
        select: { channelId: true, displayName: true },
      });

      // Pre-normalize once to avoid repeated work inside the inner loop
      const channels = rawChannels.map((ch) => ({
        channelId: ch.channelId,
        norm: normalize(ch.displayName),
      }));

      if (channels.length === 0) {
        job.status = 'done';
        job.finishedAt = new Date().toISOString();
        job.total = 0;
        job.matched = 0;
        return;
      }

      let totalStreams = 0;
      let totalMatched = 0;
      let cursor: string | undefined;

      // Cursor-based pagination — never loads all streams at once
      while (true) {
        const batch = await this.prisma.stream.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          take: BATCH_SIZE,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        if (batch.length === 0) break;

        totalStreams += batch.length;
        cursor = batch[batch.length - 1].id;

        const batchMatches: { streamId: string; epgSourceId: string; epgChannelId: string }[] = [];

        for (const stream of batch) {
          const norm = normalize(stream.name);
          let bestScore = 0;
          let bestChannelId: string | null = null;

          for (const ch of channels) {
            const score = this.similarity(norm, ch.norm);
            if (score > bestScore) {
              bestScore = score;
              bestChannelId = ch.channelId;
            }
          }

          if (bestChannelId && bestScore >= minSimilarity) {
            batchMatches.push({ streamId: stream.id, epgSourceId, epgChannelId: bestChannelId });
          }
        }

        // Batch upsert: delete then createMany — O(2) DB ops instead of O(batch_size)
        if (batchMatches.length > 0) {
          const matchedStreamIds = batchMatches.map((m) => m.streamId);
          await this.prisma.ePGMapping.deleteMany({
            where: { epgSourceId, streamId: { in: matchedStreamIds } },
          });
          await this.prisma.ePGMapping.createMany({ data: batchMatches });
          totalMatched += batchMatches.length;
        }

        // Update progress and yield event loop between batches
        job.total = totalStreams;
        job.matched = totalMatched;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }

      job.status = 'done';
      job.finishedAt = new Date().toISOString();
      job.total = totalStreams;
      job.matched = totalMatched;
      this.logger.log(`Mass assign done — ${totalMatched}/${totalStreams} matched (job ${jobId})`);
    } catch (err) {
      job.status = 'failed';
      job.finishedAt = new Date().toISOString();
      job.error = (err as Error).message;
      this.logger.error(`Mass assign failed (job ${jobId}): ${(err as Error).message}`);
    }
  }

  // Levenshtein-based normalized similarity [0, 1]
  private similarity(a: string, b: string): number {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;

    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    const dist = dp[m][n];
    return 1 - dist / Math.max(m, n);
  }

  async getNowPlaying(streamIds: string[]) {
    if (!streamIds.length) return {} as Record<string, { current: object | null; next: object | null }>;

    const now = new Date();
    const mappings = await this.prisma.ePGMapping.findMany({
      where: { streamId: { in: streamIds } },
    });

    const result: Record<string, { current: object | null; next: object | null }> = {};

    await Promise.all(
      mappings.map(async (m) => {
        const channel = await this.prisma.ePGChannel.findFirst({
          where: { epgSourceId: m.epgSourceId, channelId: m.epgChannelId },
          select: { id: true },
        });
        if (!channel) { result[m.streamId] = { current: null, next: null }; return; }

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

        result[m.streamId] = { current: current ? fmt(current) : null, next: next ? fmt(next) : null };
      }),
    );

    return result;
  }

  async getGuide(channelIds: string[], date: string) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const where = channelIds.length > 0
      ? { id: { in: channelIds } }
      : {};

    const channels = await this.prisma.ePGChannel.findMany({
      where,
      include: {
        programmes: {
          // Günle ÖRTÜŞEN tüm programlar (gece-yarısı taşanlar dahil):
          // start < günSonu AND stop > günBaşı. (Eski gte/lte gece-yarısı
          // taşan programı iki günden de düşürüyordu.)
          where: { start: { lt: dayEnd }, stop: { gt: dayStart } },
          orderBy: { start: 'asc' },
        },
      },
      take: 100,
    });

    return channels.map((ch) => ({
      channelId: ch.id,
      channelName: ch.displayName,
      tvgId: ch.channelId,
      programmes: ch.programmes.map((p) => ({
        id: p.id,
        start: p.start.toISOString(),
        stop: p.stop.toISOString(),
        title: p.title,
        description: p.description ?? '',
        durationMin: Math.round((p.stop.getTime() - p.start.getTime()) / 60000),
      })),
    }));
  }
}
