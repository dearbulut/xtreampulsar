import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface TmdbTv {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BASE = 'https://api.themoviedb.org/3';

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);
  private enrichedToday = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  private async getApiKey(): Promise<string | null> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    return settings?.tmdbApiKey ?? process.env.TMDB_API_KEY ?? null;
  }

  private parseName(raw: string): string {
    return raw
      .replace(/\(?\d{4}\)?$/, '')
      .replace(/[._\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async enrichVod(streamId: string): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return false;

    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      include: { category: true },
    });
    if (!stream) return false;

    const query = encodeURIComponent(this.parseName(stream.name));
    try {
      const res = await firstValueFrom(
        this.http.get<{ results: TmdbMovie[] }>(
          `${TMDB_BASE}/search/movie?query=${query}&language=tr-TR&api_key=${apiKey}`,
        ),
      );
      const movie = res.data.results?.[0];
      if (!movie) return false;

      await this.prisma.stream.update({
        where: { id: streamId },
        data: {
          tmdbId: movie.id,
          overview: movie.overview ?? undefined,
          posterUrl: movie.poster_path ? `${TMDB_IMAGE}${movie.poster_path}` : undefined,
          backdropUrl: movie.backdrop_path ? `${TMDB_IMAGE}${movie.backdrop_path}` : undefined,
          releaseYear: movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : undefined,
          tmdbRating: movie.vote_average ?? undefined,
        },
      });
      return true;
    } catch (err) {
      this.logger.warn(`TMDB movie lookup failed for "${stream.name}": ${(err as Error).message}`);
      return false;
    }
  }

  async enrichSeries(streamId: string): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return false;

    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) return false;

    const query = encodeURIComponent(this.parseName(stream.name));
    try {
      const res = await firstValueFrom(
        this.http.get<{ results: TmdbTv[] }>(
          `${TMDB_BASE}/search/tv?query=${query}&language=tr-TR&api_key=${apiKey}`,
        ),
      );
      const tv = res.data.results?.[0];
      if (!tv) return false;

      await this.prisma.stream.update({
        where: { id: streamId },
        data: {
          tmdbId: tv.id,
          overview: tv.overview ?? undefined,
          posterUrl: tv.poster_path ? `${TMDB_IMAGE}${tv.poster_path}` : undefined,
          backdropUrl: tv.backdrop_path ? `${TMDB_IMAGE}${tv.backdrop_path}` : undefined,
          releaseYear: tv.first_air_date ? parseInt(tv.first_air_date.slice(0, 4), 10) : undefined,
          tmdbRating: tv.vote_average ?? undefined,
        },
      });
      return true;
    } catch (err) {
      this.logger.warn(`TMDB TV lookup failed for "${stream.name}": ${(err as Error).message}`);
      return false;
    }
  }

  async enrichAllBatch(maxItems = 100): Promise<{ enriched: number; skipped: number }> {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    if (!settings?.autoEnrichMetadata) return { enriched: 0, skipped: 0 };

    const streams = await this.prisma.stream.findMany({
      where: { tmdbId: null, isActive: true },
      include: { category: true },
      take: maxItems,
    });

    let enriched = 0;
    let skipped = 0;

    for (const stream of streams) {
      if (this.enrichedToday >= maxItems) break;
      const type = stream.category.type;
      let ok = false;
      if (type === 'VOD') ok = await this.enrichVod(stream.id);
      else if (type === 'SERIES') ok = await this.enrichSeries(stream.id);
      else { skipped++; continue; }
      if (ok) { enriched++; this.enrichedToday++; }
      else skipped++;
      await new Promise((r) => setTimeout(r, 250)); // TMDB rate limit
    }

    return { enriched, skipped };
  }

  @Cron('30 3 * * *')
  async autoEnrichAll(): Promise<void> {
    this.enrichedToday = 0;
    this.logger.log('Starting nightly TMDB enrichment (03:30)...');
    const result = await this.enrichAllBatch(100);
    this.logger.log(`Enrichment done: ${result.enriched} enriched, ${result.skipped} skipped`);
  }

  async getMetadata(streamId: string) {
    return this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        name: true,
        tmdbId: true,
        overview: true,
        posterUrl: true,
        backdropUrl: true,
        releaseYear: true,
        tmdbRating: true,
        tmdbGenres: true,
      },
    });
  }
}
