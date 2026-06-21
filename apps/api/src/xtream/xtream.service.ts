import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { StreamService } from '../stream/stream.service';
import {
  XtreamAuthResponse,
  XtreamCategory,
  XtreamEpgResponse,
  XtreamLiveStream,
  XtreamServerInfo,
  XtreamUserInfo,
  XtreamVodStream,
  XtreamSeriesStream,
} from './xtream.types';

@Injectable()
export class XtreamService {
  constructor(
    private readonly userService: UserService,
    private readonly streamService: StreamService,
    private readonly config: ConfigService,
  ) {}

  async authenticate(username: string, password: string) {
    return this.userService.findByCredentials(username, password);
  }

  buildServerInfo(): XtreamServerInfo {
    const url = this.config.get<string>('server.url') ?? 'http://localhost';
    const port = this.config.get<number>('server.port') ?? 8080;
    const now = new Date();

    return {
      url,
      port: String(port),
      https_port: '443',
      server_protocol: url.startsWith('https') ? 'https' : 'http',
      rtmp_port: '1935',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp_now: Math.floor(now.getTime() / 1000),
      time_now: now.toISOString().replace('T', ' ').slice(0, 19),
    };
  }

  async buildAuthResponse(
    user: Awaited<ReturnType<UserService['findById']>>,
    username: string,
    password: string,
  ): Promise<XtreamAuthResponse> {
    const userInfo = await this.buildUserInfo(user!, username, password);
    return { user_info: userInfo, server_info: this.buildServerInfo() };
  }

  async buildUserInfo(
    user: NonNullable<Awaited<ReturnType<UserService['findById']>>>,
    username: string,
    password: string,
  ): Promise<XtreamUserInfo> {
    const statusMap: Record<string, XtreamUserInfo['status']> = {
      ACTIVE: 'Active',
      BANNED: 'Banned',
      DISABLED: 'Disabled',
      EXPIRED: 'Expired',
    };

    return {
      username,
      password,
      message: '',
      auth: 1,
      status: statusMap[user.status] ?? 'Active',
      exp_date: user.expiresAt
        ? String(Math.floor(user.expiresAt.getTime() / 1000))
        : null,
      is_trial: '0',
      active_cons: '0',
      created_at: String(Math.floor(user.createdAt.getTime() / 1000)),
      max_connections: String(user.maxConnections),
      allowed_output_formats: ['m3u8', 'ts', 'rtmpe'],
    };
  }

  async getLiveStreams(userId: string): Promise<XtreamLiveStream[]> {
    const streams = await this.streamService.findAllLive(userId);
    return streams.map((s, i) => ({
      num: i + 1,
      name: s.name,
      stream_type: 'live',
      stream_id: s.externalId,
      stream_icon: s.tvgLogo ?? '',
      epg_channel_id: s.tvgId ?? '',
      added: String(Math.floor(s.createdAt.getTime() / 1000)),
      category_id: String(s.category.externalId),
      custom_sid: '',
      tv_archive: 0,
      direct_source: '',
      tv_archive_duration: 0,
    }));
  }

  async getLiveCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findLiveCategories();
    return cats.map((c) => ({
      category_id: String(c.externalId),
      category_name: c.name,
      parent_id: 0,
    }));
  }

  async getVodStreams(userId: string): Promise<XtreamVodStream[]> {
    const streams = await this.streamService.findAllVod(userId);
    return streams.map((s, i) => ({
      num: i + 1,
      name: s.name,
      stream_type: 'movie',
      stream_id: s.externalId,
      stream_icon: s.tvgLogo ?? '',
      added: String(Math.floor(s.createdAt.getTime() / 1000)),
      category_id: String(s.category.externalId),
      custom_sid: '',
      direct_source: '',
      container_extension: 'mp4',
      rating: '0',
      rating_5based: 0,
      plot: '',
      cast: '',
      director: '',
      genre: '',
      release_date: '',
      last_modified: String(Math.floor(s.updatedAt.getTime() / 1000)),
    }));
  }

  async getVodCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findVodCategories();
    return cats.map((c) => ({
      category_id: String(c.externalId),
      category_name: c.name,
      parent_id: 0,
    }));
  }

  async getSeries(userId: string): Promise<XtreamSeriesStream[]> {
    const streams = await this.streamService.findAllSeries(userId);
    return streams.map((s, i) => ({
      num: i + 1,
      series_id: s.externalId,
      name: s.name,
      cover: s.tvgLogo ?? '',
      plot: '',
      cast: '',
      director: '',
      genre: '',
      release_date: '',
      last_modified: String(Math.floor(s.updatedAt.getTime() / 1000)),
      rating: '0',
      rating_5based: 0,
      backdrop_path: [],
      youtube_trailer: '',
      episode_run_time: '0',
      category_id: String(s.category.externalId),
    }));
  }

  async getSeriesCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findSeriesCategories();
    return cats.map((c) => ({
      category_id: String(c.externalId),
      category_name: c.name,
      parent_id: 0,
    }));
  }

  async getEpgInfo(streamId: string): Promise<XtreamEpgResponse> {
    const mappings = await this.streamService.findEpgMappings(streamId);
    // EPG parse/serve is a separate concern — return empty listings for now
    // XtreamPulsar EPG worker will populate epg_listings via Redis/DB
    return {
      epg_listings: mappings.map((m) => ({
        id: m.id,
        epg_id: m.epgChannelId,
        title: '',
        lang: 'en',
        start: '',
        end: '',
        description: '',
        channel_id: m.epgChannelId,
        start_timestamp: '0',
        stop_timestamp: '0',
        now_playing: 0,
        has_archive: 0,
      })),
    };
  }

  async buildM3UPlaylist(
    userId: string,
    username: string,
    password: string,
    type: 'all' | 'live' | 'vod' | 'series' = 'all',
    output: 'm3u8' | 'ts' = 'm3u8',
  ): Promise<string> {
    const serverInfo = this.buildServerInfo();
    const baseUrl = `${serverInfo.url}:${serverInfo.port}`;
    const ext = output === 'ts' ? 'ts' : 'm3u8';
    const lines: string[] = ['#EXTM3U'];

    if (type === 'all' || type === 'live') {
      const streams = await this.streamService.findAllLive(userId);
      for (const s of streams) {
        lines.push(
          `#EXTINF:-1 tvg-id="${s.tvgId ?? ''}" tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`,
          `${baseUrl}/live/${username}/${password}/${s.externalId}.${ext}`,
        );
      }
    }

    if (type === 'all' || type === 'vod') {
      const streams = await this.streamService.findAllVod(userId);
      for (const s of streams) {
        lines.push(
          `#EXTINF:-1 tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`,
          `${baseUrl}/movie/${username}/${password}/${s.externalId}.mp4`,
        );
      }
    }

    if (type === 'all' || type === 'series') {
      const streams = await this.streamService.findAllSeries(userId);
      for (const s of streams) {
        lines.push(
          `#EXTINF:-1 tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`,
          `${baseUrl}/series/${username}/${password}/${s.externalId}.mkv`,
        );
      }
    }

    return lines.join('\n');
  }
}
