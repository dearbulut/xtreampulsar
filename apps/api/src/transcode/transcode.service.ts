import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTranscodeProfileDto } from './dto/create-transcode-profile.dto';
import { UpdateTranscodeProfileDto } from './dto/update-transcode-profile.dto';
import { PreviewTranscodeDto } from './dto/preview-transcode.dto';
import {
  buildHlsArgs,
  previewCommand,
  abrVariantDirs,
  type TranscodeProfileLike,
} from './ffmpeg-args.builder';

/** Onizlemede kullanilan ornek girdi. */
const SAMPLE_INPUT = 'http://kaynak.example.com:8080/live/user/pass/1.ts';

/** Desteklenen kodek/hizlandirici listeleri — UI select'lerini de bu besler. */
export const VIDEO_CODECS = [
  'copy',
  'none',
  'libx264',
  'libx265',
  'h264_nvenc',
  'hevc_nvenc',
  'h264_qsv',
  'h264_vaapi',
] as const;
export const AUDIO_CODECS = ['copy', 'none', 'aac', 'mp3', 'ac3'] as const;
export const HW_ACCELS = ['', 'cuda', 'qsv', 'vaapi', 'videotoolbox'] as const;
export const PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
] as const;

@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────── CRUD ────────────────────────────────────

  findAll() {
    return this.prisma.transcodeProfile.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { streams: true } } },
    });
  }

  /** Akis formundaki select icin hafif liste (sadece aktif profiller). */
  options() {
    return this.prisma.transcodeProfile.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        abrEnabled: true,
        videoCodec: true,
        height: true,
      },
    });
  }

  /** UI'nin select seceneklerini sabit kodlamamasi icin. */
  codecs() {
    return {
      videoCodecs: [...VIDEO_CODECS],
      audioCodecs: [...AUDIO_CODECS],
      hwAccels: [...HW_ACCELS],
      presets: [...PRESETS],
    };
  }

  async findById(id: string) {
    const profile = await this.prisma.transcodeProfile.findUnique({
      where: { id },
      include: { _count: { select: { streams: true } } },
    });
    if (!profile) throw new NotFoundException('Transcode profili bulunamadi');
    return profile;
  }

  async create(dto: CreateTranscodeProfileDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Profil adi zorunlu');

    const exists = await this.prisma.transcodeProfile.findUnique({
      where: { name },
    });
    if (exists) throw new BadRequestException('Bu isimde bir profil zaten var');

    const data = this.toPrismaData(dto);
    const created = await this.prisma.transcodeProfile.create({
      data: { ...data, name, isSystem: false },
    });
    if (created.isDefault) await this.clearOtherDefaults(created.id);
    return created;
  }

  async update(id: string, dto: UpdateTranscodeProfileDto) {
    const profile = await this.prisma.transcodeProfile.findUnique({
      where: { id },
    });
    if (!profile) throw new NotFoundException('Transcode profili bulunamadi');

    const data = this.toPrismaData(dto);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Profil adi zorunlu');
      if (profile.isSystem && name !== profile.name) {
        throw new BadRequestException(
          'Sistem profillerinin adi degistirilemez',
        );
      }
      if (name !== profile.name) {
        const clash = await this.prisma.transcodeProfile.findUnique({
          where: { name },
        });
        if (clash) throw new BadRequestException('Bu isimde bir profil zaten var');
      }
      data.name = name;
    }

    const updated = await this.prisma.transcodeProfile.update({
      where: { id },
      data,
    });
    if (updated.isDefault) await this.clearOtherDefaults(updated.id);
    return updated;
  }

  async remove(id: string) {
    const profile = await this.prisma.transcodeProfile.findUnique({
      where: { id },
      include: { _count: { select: { streams: true } } },
    });
    if (!profile) throw new NotFoundException('Transcode profili bulunamadi');
    if (profile.isSystem) {
      throw new BadRequestException('Sistem profilleri silinemez');
    }
    // FK onDelete: SetNull — akislar bagimsiz kalir, yine de kullaniciyi uyar.
    await this.prisma.transcodeProfile.delete({ where: { id } });
    return { deleted: true, detachedStreams: profile._count.streams };
  }

  /** Profili kopyalar; kopya her zaman kullanici profili olur. */
  async clone(id: string) {
    const src = await this.prisma.transcodeProfile.findUnique({
      where: { id },
    });
    if (!src) throw new NotFoundException('Transcode profili bulunamadi');

    let name = `${src.name} (kopya)`;
    for (let i = 2; i < 100; i++) {
      const clash = await this.prisma.transcodeProfile.findUnique({
        where: { name },
      });
      if (!clash) break;
      name = `${src.name} (kopya ${i})`;
    }

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
    return this.prisma.transcodeProfile.create({
      data: {
        ...rest,
        name,
        isSystem: false,
        isDefault: false,
        abrVariants: (src.abrVariants ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async setDefault(id: string) {
    await this.findById(id);
    const updated = await this.prisma.transcodeProfile.update({
      where: { id },
      data: { isDefault: true, isActive: true },
    });
    await this.clearOtherDefaults(id);
    return updated;
  }

  // ───────────────────────────── Onizleme ──────────────────────────────────

  /**
   * Profilin uretecegi ffmpeg komutunu (calistirmadan) dondurur.
   * streamId verilirse o akisin UA/header/customFfmpeg ayarlari da uygulanir.
   */
  async preview(id: string, dto: PreviewTranscodeDto = {}) {
    const profile = await this.prisma.transcodeProfile.findUnique({
      where: { id },
    });
    if (!profile) throw new NotFoundException('Transcode profili bulunamadi');

    const stream = dto.streamId
      ? await this.prisma.stream.findUnique({
          where: { id: dto.streamId },
          select: {
            id: true,
            name: true,
            primaryUrl: true,
            streamUserAgent: true,
            httpHeaders: true,
            httpCookie: true,
            customMap: true,
            customFfmpeg: true,
            generatePts: true,
            probeSize: true,
          },
        })
      : null;

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { ffmpegProbeSize: true, ffmpegAnalyzeDurationUs: true },
    });

    const inputUrl =
      dto.inputUrl?.trim() || stream?.primaryUrl || SAMPLE_INPUT;
    const outDir = `/tmp/xtreampulsar/hls/${stream?.id ?? 'ORNEK'}`;

    const args = buildHlsArgs({
      profile: profile as unknown as TranscodeProfileLike,
      inputUrl,
      outputFile: `${outDir}/index.m3u8`,
      segmentPattern: `${outDir}/seg%05d.ts`,
      outputDir: outDir,
      userAgent: stream?.streamUserAgent,
      headers: stream?.httpHeaders,
      cookie: stream?.httpCookie,
      customMap: stream?.customMap,
      customFfmpeg: stream?.customFfmpeg,
      generatePts: stream?.generatePts,
      probeSize: stream?.probeSize || settings?.ffmpegProbeSize || null,
      analyzeDurationUs: settings?.ffmpegAnalyzeDurationUs || null,
    });

    const ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
    return {
      profileId: profile.id,
      profileName: profile.name,
      streamId: stream?.id ?? null,
      streamName: stream?.name ?? null,
      inputUrl,
      outputDir: outDir,
      variantDirs: abrVariantDirs(profile as unknown as TranscodeProfileLike),
      args,
      command: previewCommand(ffmpegPath, args),
    };
  }

  // ─────────────────────────── Akisa atama ─────────────────────────────────

  /** Toplu atama: secili akislarin profilini degistirir (null ⇒ kaldir). */
  async assignToStreams(streamIds: string[], profileId: string | null) {
    if (!streamIds?.length) {
      throw new BadRequestException('Akis secilmedi');
    }
    if (profileId) await this.findById(profileId);

    const res = await this.prisma.stream.updateMany({
      where: { id: { in: streamIds } },
      data: { transcodeProfileId: profileId },
    });
    this.logger.log(
      `Transcode profili ${profileId ?? '(kaldirildi)'} -> ${res.count} akis`,
    );
    return { updated: res.count };
  }

  // ──────────────────────────── Yardimcilar ────────────────────────────────

  private async clearOtherDefaults(keepId: string) {
    await this.prisma.transcodeProfile.updateMany({
      where: { id: { not: keepId }, isDefault: true },
      data: { isDefault: false },
    });
  }

  /** DTO -> Prisma data (abrVariants Json donusumu dahil). */
  private toPrismaData(
    dto: CreateTranscodeProfileDto | UpdateTranscodeProfileDto,
  ): Prisma.TranscodeProfileUncheckedCreateInput {
    const { name, abrVariants, ...rest } = dto as CreateTranscodeProfileDto;
    const data = { ...rest } as Prisma.TranscodeProfileUncheckedCreateInput;
    if (name !== undefined) data.name = name;
    if (abrVariants !== undefined) {
      data.abrVariants = (abrVariants === null
        ? Prisma.JsonNull
        : (abrVariants as unknown as Prisma.InputJsonValue)) as Prisma.InputJsonValue;
    }
    return data;
  }
}
