import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { StreamService } from '../stream/stream.service';
import { SettingsService } from '../settings/settings.service';
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
    private readonly settingsService: SettingsService,
  ) {}

  async authenticate(username: string, password: string) {
    return this.userService.findByCredentials(username, password);
  }

  async buildServerInfo(): Promise<XtreamServerInfo> {
    const activeUrl = await this.settingsService.getActiveServerUrl();
    const url = activeUrl || this.config.get<string>('server.url') || 'http://localhost';
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
    return { user_info: userInfo, server_info: await this.buildServerInfo() };
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
    return streams.map((s, i) => {
      const sc = s as typeof s & { catchupEnabled?: boolean; catchupDays?: number; isRadio?: boolean };
      return {
        num: i + 1,
        name: s.name,
        stream_type: 'live',
        stream_id: s.externalId,
        stream_icon: s.tvgLogo ?? '',
        epg_channel_id: s.tvgId ?? '',
        added: String(Math.floor(s.createdAt.getTime() / 1000)),
        category_id: String(s.category.externalId),
        custom_sid: '',
        tv_archive: sc.catchupEnabled ? 1 : 0,
        direct_source: '',
        tv_archive_duration: sc.catchupEnabled ? (sc.catchupDays ?? 7) : 0,
        is_radio: sc.isRadio ? 1 : 0,
      };
    });
  }

  async getLiveCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findLiveCategories(userId);
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
      stream_icon: s.posterUrl ?? s.tvgLogo ?? '',
      added: String(Math.floor(s.createdAt.getTime() / 1000)),
      category_id: String(s.category.externalId),
      custom_sid: '',
      direct_source: '',
      container_extension: (s.primaryUrl.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)?.[1] || 'mp4').toLowerCase(),
      rating: s.tmdbRating != null ? String(s.tmdbRating) : '0',
      rating_5based: s.tmdbRating != null ? Math.round((s.tmdbRating / 2) * 10) / 10 : 0,
      plot: s.overview ?? '',
      cast: '',
      director: '',
      genre: (s.tmdbGenres ?? []).join(', '),
      release_date: s.releaseYear ? String(s.releaseYear) : '',
      last_modified: String(Math.floor(s.updatedAt.getTime() / 1000)),
    }));
  }

  async getVodCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findVodCategories(userId);
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
      cover: s.posterUrl ?? s.tvgLogo ?? '',
      plot: s.overview ?? '',
      cast: '',
      director: '',
      genre: (s.tmdbGenres ?? []).join(', '),
      release_date: s.releaseYear ? String(s.releaseYear) : '',
      last_modified: String(Math.floor(s.updatedAt.getTime() / 1000)),
      rating: s.tmdbRating != null ? String(s.tmdbRating) : '0',
      rating_5based: s.tmdbRating != null ? Math.round((s.tmdbRating / 2) * 10) / 10 : 0,
      backdrop_path: s.backdropUrl ? [s.backdropUrl] : [],
      youtube_trailer: '',
      episode_run_time: '0',
      category_id: String(s.category.externalId),
    }));
  }

  async getSeriesInfo(seriesExternalId: number) {
    const series = await this.streamService.findByExternalId(seriesExternalId);
    if (!series) return { seasons: [], info: {}, episodes: {} };
    const eps = await this.streamService.getSeriesEpisodes(series.id);
    const episodes: Record<string, any[]> = {};
    for (const e of eps) {
      const sk = String(e.season);
      (episodes[sk] ??= []).push({
        id: String(e.externalId), episode_num: e.episode, title: e.title ?? series.name,
        container_extension: e.containerExtension,
        info: { plot: e.plot ?? '', duration_secs: e.durationSecs ?? 0, duration: '',
                rating: e.tmdbRating != null ? String(e.tmdbRating) : '0',
                movie_image: e.cover ?? series.posterUrl ?? '', releasedate: e.releaseDate ?? '', season: e.season },
        added: String(Math.floor(e.createdAt.getTime() / 1000)), season: e.season,
      });
    }
    const seasons = Object.keys(episodes).map((s) => ({ season_number: Number(s), name: `Season ${s}`, episode_count: episodes[s].length }));
    return {
      seasons,
      info: {
        name: series.name, cover: series.posterUrl ?? series.tvgLogo ?? '', plot: series.overview ?? '',
        cast: '', director: '', genre: (series.tmdbGenres ?? []).join(', '),
        releaseDate: series.releaseYear ? String(series.releaseYear) : '',
        rating: series.tmdbRating != null ? String(series.tmdbRating) : '0',
        rating_5based: series.tmdbRating != null ? Math.round((series.tmdbRating / 2) * 10) / 10 : 0,
        backdrop_path: series.backdropUrl ? [series.backdropUrl] : [], youtube_trailer: '',
        episode_run_time: '0', category_id: String(series.category.externalId),
      },
      episodes,
    };
  }

  async getVodInfo(vodExternalId: number) {
    const vod = await this.streamService.findByExternalId(vodExternalId);
    if (!vod) return { info: {}, movie_data: {} };
    const ext = (vod.primaryUrl.match(/\.([a-z0-9]{2,4})(?:\?|$)/i)?.[1] || 'mp4').toLowerCase();
    const durationSecs = vod.durationSecs ?? 0;
    const durationStr = durationSecs > 0
      ? `${Math.floor(durationSecs / 3600).toString().padStart(2, '0')}:${Math.floor((durationSecs % 3600) / 60).toString().padStart(2, '0')}:${(durationSecs % 60).toString().padStart(2, '0')}`
      : '';
    return {
      info: {
        movie_image: vod.posterUrl ?? vod.tvgLogo ?? '', plot: vod.overview ?? '', cast: '', director: '',
        genre: (vod.tmdbGenres ?? []).join(', '), releasedate: vod.releaseYear ? String(vod.releaseYear) : '',
        rating: vod.tmdbRating != null ? String(vod.tmdbRating) : '0',
        rating_5based: vod.tmdbRating != null ? Math.round((vod.tmdbRating / 2) * 10) / 10 : 0,
        backdrop_path: vod.backdropUrl ? [vod.backdropUrl] : [], duration_secs: durationSecs, duration: durationStr, container_extension: ext,
      },
      movie_data: { stream_id: vod.externalId, name: vod.name, added: String(Math.floor(vod.createdAt.getTime() / 1000)),
                    category_id: String(vod.category.externalId), container_extension: ext },
    };
  }

  async getSeriesCategories(userId: string): Promise<XtreamCategory[]> {
    const cats = await this.streamService.findSeriesCategories(userId);
    return cats.map((c) => ({
      category_id: String(c.externalId),
      category_name: c.name,
      parent_id: 0,
    }));
  }

  private fmtEpgDate(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  async getEpgInfo(streamId: string, limit = 12): Promise<XtreamEpgResponse> {
    const progs = await this.streamService.getStreamProgrammes(streamId, limit, true);
    const now = new Date();
    return {
      epg_listings: progs.map((p) => ({
        id: p.id,
        epg_id: p.epgId,
        title: Buffer.from(p.title || '').toString('base64'),
        lang: '',
        start: this.fmtEpgDate(p.start),
        end: this.fmtEpgDate(p.stop),
        description: Buffer.from(p.description || '').toString('base64'),
        channel_id: p.epgId,
        start_timestamp: String(Math.floor(p.start.getTime() / 1000)),
        stop_timestamp: String(Math.floor(p.stop.getTime() / 1000)),
        now_playing: p.start <= now && p.stop > now ? 1 : 0,
        has_archive: 0,
      })),
    };
  }

  /** xmltv.php — kullanıcının kanalları için tam XMLTV çıktısı (TiviMate vb. için). */
  async buildXmltv(userId: string): Promise<string> {
    const channels = await this.streamService.getUserEpgChannels(userId);
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const xmltvDate = (d: Date): string => {
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())} +0000`;
    };
    let channelsXml = '';
    let programmesXml = '';
    for (const { stream, mapping } of channels) {
      const chId = esc(mapping.epgChannelId);
      channelsXml += `  <channel id="${chId}">\n    <display-name>${esc(stream.name)}</display-name>\n`;
      if (stream.tvgLogo) channelsXml += `    <icon src="${esc(stream.tvgLogo)}" />\n`;
      channelsXml += `  </channel>\n`;
      const progs = await this.streamService.getStreamProgrammes(stream.id, 60, false);
      for (const p of progs) {
        programmesXml += `  <programme start="${xmltvDate(p.start)}" stop="${xmltvDate(p.stop)}" channel="${chId}">\n`;
        programmesXml += `    <title>${esc(p.title || '')}</title>\n`;
        if (p.description) programmesXml += `    <desc>${esc(p.description)}</desc>\n`;
        programmesXml += `  </programme>\n`;
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<tv generator-info-name="XtreamPulsar">\n${channelsXml}${programmesXml}</tv>\n`;
  }

  async buildM3UPlaylist(
    userId: string,
    username: string,
    password: string,
    type: 'all' | 'live' | 'vod' | 'series' = 'all',
    output: 'm3u8' | 'ts' = 'm3u8',
    plus = true,
  ): Promise<string> {
    const serverInfo = await this.buildServerInfo();
    const baseUrl = `${serverInfo.url}:${serverInfo.port}`;
    const ext = output === 'ts' ? 'ts' : 'm3u8';
    const lines: string[] = ['#EXTM3U'];

    if (type === 'all' || type === 'live') {
      const streams = await this.streamService.findAllLive(userId);
      for (const s of streams) {
        const sc = s as typeof s & { catchupEnabled?: boolean; catchupDays?: number; isRadio?: boolean };
        const catchup = sc.catchupEnabled
          ? ` catchup="default" catchup-days="${sc.catchupDays ?? 7}" tv-archive="1" tv-archive-duration="${sc.catchupDays ?? 7}" catchup-source="${baseUrl}/live/${username}/${password}/${s.externalId}.ts?utc={utc}&duration={duration}"`
          : '';
        lines.push(
          plus
            ? `#EXTINF:-1 tvg-id="${s.tvgId ?? ''}" tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}"${catchup} group-title="${s.category.name}",${s.name}`
            : `#EXTINF:-1,${s.name}`,
          `${baseUrl}/live/${username}/${password}/${s.externalId}.${ext}`,
        );
      }
    }

    if (type === 'all' || type === 'vod') {
      const streams = await this.streamService.findAllVod(userId);
      for (const s of streams) {
        lines.push(
          plus
            ? `#EXTINF:-1 tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`
            : `#EXTINF:-1,${s.name}`,
          `${baseUrl}/movie/${username}/${password}/${s.externalId}.${((s as { targetContainer?: string | null }).targetContainer || 'mp4').replace(/^\./, '')}`,
        );
      }
    }

    if (type === 'all' || type === 'series') {
      const streams = await this.streamService.findAllSeries(userId);
      for (const s of streams) {
        lines.push(
          plus
            ? `#EXTINF:-1 tvg-name="${s.name}" tvg-logo="${s.tvgLogo ?? ''}" group-title="${s.category.name}",${s.name}`
            : `#EXTINF:-1,${s.name}`,
          `${baseUrl}/series/${username}/${password}/${s.externalId}.mkv`,
        );
      }
    }

    return lines.join('\n');
  }

  /** Enigma2 (VU+/Dreambox) userbouquet — kullanicinin canli kanallari, 4097 IPTV service ref. */
  async buildEnigma2Bouquet(
    userId: string,
    username: string,
    password: string,
  ): Promise<{ content: string; filename: string }> {
    const serverInfo = await this.buildServerInfo();
    const baseUrl = `${serverInfo.url}:${serverInfo.port}`;
    const streams = await this.streamService.findAllLive(userId);
    const lines: string[] = [`#NAME ${username} IPTV`];
    for (const s of streams) {
      const url = `${baseUrl}/live/${username}/${password}/${s.externalId}.ts`;
      const enc = url.replace(/:/g, '%3a');
      const name = (s.name || '').replace(/[:\r\n]+/g, ' ').trim();
      lines.push(`#SERVICE 4097:0:1:0:0:0:0:0:0:0:${enc}:${name}`, `#DESCRIPTION ${name}`);
    }
    return { content: lines.join('\n') + '\n', filename: `userbouquet.${username.replace(/[^\w.-]/g, '')}.tv` };
  }
}
