import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpgSourceDto } from './dto/create-epg-source.dto';
import { UpdateEpgSourceDto } from './dto/update-epg-source.dto';
import { CreateEpgMappingDto } from './dto/create-epg-mapping.dto';
import { EpgParserService } from './epg-parser.service';

@Injectable()
export class EpgService {
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
    void this.parserService.parseSourceById(sourceId);
    return { message: 'EPG parse triggered' };
  }

  async triggerParseAll() {
    const sources = await this.prisma.ePGSource.findMany({ where: { isActive: true } });
    if (!sources.length) return { total: 0, success: 0, failed: 0 };
    const results = await Promise.allSettled(
      sources.map((src) => this.parserService.parseSourceById(src.id)),
    );
    const success = results.filter((r) => r.status === 'fulfilled').length;
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

  // ─── Mass assign ─────────────────────────────────────────────────────────

  async massAssign(epgSourceId: string, minSimilarity = 0.6, stripPrefixes: string[] = []) {
    await this.findSourceById(epgSourceId);

    const normalize = (name: string): string => {
      let s = name;
      for (const prefix of stripPrefixes) {
        if (!prefix) continue;
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        s = s.replace(new RegExp(`^${escaped}`, 'i'), '');
      }
      return s.trim();
    };

    const [streams, channels] = await Promise.all([
      this.prisma.stream.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.ePGChannel.findMany({
        where: { epgSourceId },
        select: { id: true, channelId: true, displayName: true },
      }),
    ]);

    const matches: { streamId: string; epgSourceId: string; epgChannelId: string }[] = [];

    for (const stream of streams) {
      let bestScore = 0;
      let bestChannel: (typeof channels)[0] | null = null;

      for (const ch of channels) {
        const score = this.similarity(normalize(stream.name), normalize(ch.displayName));
        if (score > bestScore) {
          bestScore = score;
          bestChannel = ch;
        }
      }

      if (bestChannel && bestScore >= minSimilarity) {
        matches.push({ streamId: stream.id, epgSourceId, epgChannelId: bestChannel.channelId });
      }
    }

    for (const m of matches) {
      await this.prisma.ePGMapping.upsert({
        where: { streamId_epgSourceId: { streamId: m.streamId, epgSourceId: m.epgSourceId } },
        create: m,
        update: { epgChannelId: m.epgChannelId },
      });
    }

    return { matched: matches.length, total: streams.length };
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
          where: { start: { gte: dayStart }, stop: { lte: dayEnd } },
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
