import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';

@Injectable()
export class EpisodeService {
  constructor(private readonly prisma: PrismaService) {}

  list(seriesId: string) {
    return this.prisma.episode.findMany({
      where: { seriesId },
      orderBy: [{ season: 'asc' }, { episode: 'asc' }],
    });
  }

  async create(seriesId: string, dto: CreateEpisodeDto) {
    const series = await this.prisma.stream.findUnique({
      where: { id: seriesId },
      select: { id: true, category: { select: { type: true } } },
    });
    if (!series) throw new NotFoundException(`Series ${seriesId} not found`);
    if (series.category?.type !== 'SERIES')
      throw new BadRequestException('Bölüm yalnız SERIES tipi içeriğe eklenebilir');
    try {
      return await this.prisma.episode.create({ data: { seriesId, ...dto } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu sezon/bölüm zaten var');
      }
      throw err;
    }
  }

  async update(seriesId: string, episodeId: string, dto: UpdateEpisodeDto) {
    const existing = await this.prisma.episode.findFirst({ where: { id: episodeId, seriesId }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Episode ${episodeId} not found`);
    try {
      return await this.prisma.episode.update({ where: { id: episodeId }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu sezon/bölüm zaten var');
      }
      throw err;
    }
  }

  async remove(seriesId: string, episodeId: string) {
    const existing = await this.prisma.episode.findFirst({ where: { id: episodeId, seriesId }, select: { id: true } });
    if (!existing) throw new NotFoundException(`Episode ${episodeId} not found`);
    return this.prisma.episode.delete({ where: { id: episodeId } });
  }
}
