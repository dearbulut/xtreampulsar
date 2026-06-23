import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Prisma } from '@xtreampulsar/database';
import { PrismaService } from '../../prisma/prisma.service';
import { StreamService } from '../../stream/stream.service';

export interface PlaylistFilters {
  onlyLive?: boolean;
  onlyVod?: boolean;
}

export interface CreatePlaylistDto {
  name: string;
  type?: string;
  filters?: PlaylistFilters | null;
  expiresAt?: string | null;
}

export interface UpdatePlaylistDto {
  name?: string;
  type?: string;
  filters?: PlaylistFilters | null;
  isActive?: boolean;
  expiresAt?: string | null;
}

@Injectable()
export class PlaylistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streamService: StreamService,
    private readonly config: ConfigService,
  ) {}

  private buildBaseUrl(): string {
    const url = this.config.get<string>('server.url') ?? 'http://localhost';
    const port = this.config.get<number>('server.port') ?? 8080;
    return `${url}:${port}`;
  }

  async createPlaylist(userId: string, dto: CreatePlaylistDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.userPlaylist.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type ?? 'm3u_plus',
        filters: (dto.filters ?? undefined) as Prisma.InputJsonValue | undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async getUserPlaylists(userId: string) {
    return this.prisma.userPlaylist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlaylist(id: string, dto: UpdatePlaylistDto) {
    const playlist = await this.prisma.userPlaylist.findUnique({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');

    return this.prisma.userPlaylist.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.filters !== undefined ? { filters: (dto.filters ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
      },
    });
  }

  async deletePlaylist(id: string) {
    const playlist = await this.prisma.userPlaylist.findUnique({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    await this.prisma.userPlaylist.delete({ where: { id } });
  }

  async servePlaylist(token: string, res: Response) {
    const playlist = await this.prisma.userPlaylist.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, username: true, status: true, expiresAt: true, deletedAt: true } },
      },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    if (!playlist.isActive) throw new BadRequestException('Playlist is inactive');
    if (playlist.expiresAt && playlist.expiresAt < new Date())
      throw new BadRequestException('Playlist has expired');
    if (playlist.user.deletedAt) throw new BadRequestException('User account not found');
    if (playlist.user.status !== 'ACTIVE') throw new BadRequestException('User account is not active');
    if (playlist.user.expiresAt < new Date())
      throw new BadRequestException('User subscription has expired');

    await this.prisma.userPlaylist.update({
      where: { id: playlist.id },
      data: { lastAccessed: new Date(), accessCount: { increment: 1 } },
    });

    const filters = playlist.filters as PlaylistFilters | null;
    const streamType = filters?.onlyLive ? 'live' : filters?.onlyVod ? 'vod' : 'all';
    const ext = playlist.type === 'ts' ? 'ts' : 'm3u8';
    const isM3uPlus = playlist.type === 'm3u_plus';
    const baseUrl = this.buildBaseUrl();
    const { username } = playlist.user;
    // The playlist token acts as "password" in stream URLs — findByCredentials also validates tokens
    const pwd = token;

    const epgUrl = `${baseUrl}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(pwd)}`;
    const lines: string[] = [
      `#EXTM3U url-tvg="${epgUrl}" tvg-shift=0 x-tvg-url="${epgUrl}"`,
    ];

    if (streamType === 'all' || streamType === 'live') {
      const streams = await this.streamService.findAllLive(playlist.userId);
      for (const s of streams) {
        const extinf = isM3uPlus
          ? `#EXTINF:-1 tvg-id="${s.tvgId ?? ''}" tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`
          : `#EXTINF:-1,${s.name}`;
        lines.push(extinf, `${baseUrl}/live/${username}/${pwd}/${s.externalId}.${ext}`);
      }
    }

    if (streamType === 'all' || streamType === 'vod') {
      const streams = await this.streamService.findAllVod(playlist.userId);
      for (const s of streams) {
        const extinf = isM3uPlus
          ? `#EXTINF:-1 tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`
          : `#EXTINF:-1,${s.name}`;
        lines.push(extinf, `${baseUrl}/movie/${username}/${pwd}/${s.externalId}.mp4`);
      }
    }

    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${playlist.name}.m3u"`);
    res.send(lines.join('\n'));
  }

  async getPlaylistInfo(token: string) {
    const playlist = await this.prisma.userPlaylist.findUnique({
      where: { token },
      select: {
        id: true, name: true, type: true, isActive: true,
        expiresAt: true, lastAccessed: true, accessCount: true,
        createdAt: true, filters: true,
        user: { select: { username: true, status: true, expiresAt: true } },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }
}
