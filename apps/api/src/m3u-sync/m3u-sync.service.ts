import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MigrationService } from '../migration/migration.service';
import { CreateM3uSourceDto, UpdateM3uSourceDto } from './dto/m3u-source.dto';

type M3uSource = {
  id: string;
  name: string;
  url: string;
  defaultType: string;
  defaultBouquetId: string | null;
  conflictMode: string;
  enabled: boolean;
  intervalMinutes: number;
  lastSyncedAt: Date | null;
};

@Injectable()
export class M3uSyncService {
  private readonly logger = new Logger(M3uSyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly migration: MigrationService,
  ) {}

  list() {
    return this.prisma.m3uSource.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateM3uSourceDto) {
    return this.prisma.m3uSource.create({
      data: {
        name: dto.name.trim(),
        url: dto.url.trim(),
        defaultType: dto.defaultType ?? 'LIVE',
        defaultBouquetId: dto.defaultBouquetId ?? null,
        conflictMode: dto.conflictMode ?? 'MERGE',
        enabled: dto.enabled ?? true,
        intervalMinutes: dto.intervalMinutes ?? 360,
      },
    });
  }

  async update(id: string, dto: UpdateM3uSourceDto) {
    await this.ensure(id);
    return this.prisma.m3uSource.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        url: dto.url?.trim(),
        defaultType: dto.defaultType,
        defaultBouquetId: dto.defaultBouquetId ?? undefined,
        conflictMode: dto.conflictMode,
        enabled: dto.enabled,
        intervalMinutes: dto.intervalMinutes,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.m3uSource.delete({ where: { id } });
    return { deleted: true };
  }

  async syncNow(id: string) {
    const src = await this.prisma.m3uSource.findUnique({ where: { id } });
    if (!src) throw new NotFoundException('M3U source not found');
    return this.runSync(src as M3uSource);
  }

  private async ensure(id: string) {
    const s = await this.prisma.m3uSource.findUnique({ where: { id }, select: { id: true } });
    if (!s) throw new NotFoundException('M3U source not found');
  }

  private async runSync(src: M3uSource): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.migration.importM3uFromUrl(src.url, {
        defaultType: src.defaultType,
        defaultBouquetId: src.defaultBouquetId ?? undefined,
        conflictMode: (src.conflictMode as 'SKIP' | 'OVERWRITE' | 'MERGE') ?? 'MERGE',
        dryRun: false,
      });
      await this.prisma.m3uSource.update({
        where: { id: src.id },
        data: { lastSyncedAt: new Date(), lastStatus: 'OK', lastMessage: null },
      });
      return { ok: true };
    } catch (err) {
      const msg = (err as Error).message ?? 'unknown';
      this.logger.error(`M3U sync failed for ${src.name}: ${msg}`);
      await this.prisma.m3uSource.update({
        where: { id: src.id },
        data: { lastSyncedAt: new Date(), lastStatus: 'ERROR', lastMessage: msg.slice(0, 300) },
      });
      return { ok: false, error: msg };
    }
  }

  // Her 5 dakikada bir: süresi gelen aktif kaynakları senkronla.
  @Cron('*/5 * * * *')
  async scheduledSync() {
    if (this.running) return;
    this.running = true;
    try {
      const now = Date.now();
      const sources = (await this.prisma.m3uSource.findMany({ where: { enabled: true } })) as M3uSource[];
      for (const src of sources) {
        const due = !src.lastSyncedAt || now - src.lastSyncedAt.getTime() >= src.intervalMinutes * 60_000;
        if (due) {
          this.logger.log(`Auto-syncing M3U source: ${src.name}`);
          await this.runSync(src);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
