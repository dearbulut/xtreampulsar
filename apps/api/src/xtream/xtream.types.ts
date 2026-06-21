// ─── Xtream Codes API — birebir uyumlu response tipleri ─────────────────────

export interface XtreamUserInfo {
  username: string;
  password: string;
  message: string;
  auth: 0 | 1;
  status: 'Active' | 'Banned' | 'Disabled' | 'Expired';
  exp_date: string | null;
  is_trial: '0' | '1';
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: Array<'m3u8' | 'ts' | 'rtmpe'>;
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: 'http' | 'https';
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

export interface XtreamAuthResponse {
  user_info: XtreamUserInfo;
  server_info: XtreamServerInfo;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: 'live';
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: 0 | 1;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: 'movie';
  stream_id: number;
  stream_icon: string;
  added: string;
  category_id: string;
  custom_sid: string;
  direct_source: string;
  container_extension: string;
  rating: string;
  rating_5based: number;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  release_date: string;
  last_modified: string;
}

export interface XtreamSeriesStream {
  num: number;
  series_id: number;
  name: string;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  release_date: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamEpgListing {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: string;
  stop_timestamp: string;
  now_playing: 0 | 1;
  has_archive: 0 | 1;
}

export interface XtreamEpgResponse {
  epg_listings: XtreamEpgListing[];
}
