import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { XtreamService } from './xtream.service';
import { StreamService } from '../stream/stream.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';

interface PlayerApiQuery {
  username?: string;
  password?: string;
  action?: string;
  category_id?: string;
  stream_id?: string;
  vod_id?: string;
  series_id?: string;
  limit?: string;
}

interface GetPhpQuery {
  username?: string;
  password?: string;
  type?: string;
  output?: string;
}

@Controller()
export class XtreamController {
  constructor(
    private readonly xtream: XtreamService,
    private readonly streamService: StreamService,
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Authentication + action dispatch ──────────────────────────────────────

  @Get('player_api.php')
  async playerApi(
    @Query() query: PlayerApiQuery,
    @Res() res: Response,
  ): Promise<void> {
    const { username = '', password = '', action } = query;

    const user = await this.xtream.authenticate(username, password);

    if (!user) {
      res.json({
        user_info: {
          auth: 0,
          message: 'Invalid username or password',
        },
        server_info: this.xtream.buildServerInfo(),
      });
      return;
    }

    if (!action) {
      res.json(await this.xtream.buildAuthResponse(user, username, password));
      return;
    }

    switch (action) {
      case 'get_live_categories':
        res.json(await this.xtream.getLiveCategories(user.id));
        break;

      case 'get_vod_categories':
        res.json(await this.xtream.getVodCategories(user.id));
        break;

      case 'get_series_categories':
        res.json(await this.xtream.getSeriesCategories(user.id));
        break;

      case 'get_live_streams':
        res.json(await this.xtream.getLiveStreams(user.id));
        break;

      case 'get_vod_streams':
        res.json(await this.xtream.getVodStreams(user.id));
        break;

      case 'get_series':
        res.json(await this.xtream.getSeries(user.id));
        break;

      case 'get_short_epg':
      case 'get_simple_data_table': {
        const sid = query.stream_id ?? query.vod_id ?? '';
        const stream = sid ? await this.streamService.findByExternalId(parseInt(sid, 10)) : null;
        if (!stream) {
          res.status(HttpStatus.NOT_FOUND).json({ epg_listings: [] });
        } else {
          res.json(await this.xtream.getEpgInfo(stream.id));
        }
        break;
      }

      default:
        res.status(HttpStatus.BAD_REQUEST).json({
          error: `Unknown action: ${action}`,
        });
    }
  }

  // ─── M3U Playlist ──────────────────────────────────────────────────────────

  @Get('get.php')
  async getM3u(
    @Query() query: GetPhpQuery,
    @Res() res: Response,
  ): Promise<void> {
    const { username = '', password = '', type = 'm3u_plus', output = 'm3u8' } = query;

    const user = await this.xtream.authenticate(username, password);
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).send('Invalid credentials');
      return;
    }

    const streamType: 'all' | 'live' | 'vod' | 'series' =
      type === 'live' ? 'live'
      : type === 'vod' ? 'vod'
      : type === 'series' ? 'series'
      : 'all';

    const safeOutput: 'm3u8' | 'ts' = output === 'ts' ? 'ts' : 'm3u8';
    const playlist = await this.xtream.buildM3UPlaylist(
      user.id, username, password, streamType, safeOutput,
    );

    res
      .set('Content-Type', 'application/x-mpegurl')
      .set('Content-Disposition', `attachment; filename="${username}.m3u"`)
      .send(playlist);
  }

  // ─── Stream proxy helpers ───────────────────────────────────────────────────

  private async authorizeAndGetUrl(
    username: string,
    password: string,
    rawStreamId: string,
    res: Response,
    extension: string,
  ): Promise<string | null> {
    const user = await this.xtream.authenticate(username, password);
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
      return null;
    }

    const ext = new RegExp(`\\.(${extension})$`, 'i');
    const externalId = parseInt(rawStreamId.replace(ext, ''), 10);
    if (isNaN(externalId)) {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID');
      return null;
    }

    try {
      const validation = await this.userService.validateConnection(
        user.id,
        (res.req as Request).ip ?? '',
        (res.req as Request).headers['user-agent'],
      );
      if (!validation.allowed) {
        res.status(HttpStatus.FORBIDDEN).send(validation.reason ?? 'Forbidden');
        return null;
      }

      return await this.streamService.getStreamUrl(externalId);
    } catch {
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return null;
    }
  }

  private proxyToUpstream(
    streamUrl: string,
    req: Request,
    res: Response,
  ): void {
    const target = new URL(streamUrl);
    const client = target.protocol === 'https:' ? https : http;
    const port = target.port
      ? parseInt(target.port, 10)
      : target.protocol === 'https:'
        ? 443
        : 80;

    const proxyReq = client.request(
      {
        hostname: target.hostname,
        port,
        path: target.pathname + target.search,
        method: 'GET',
        headers: {
          'User-Agent': req.headers['user-agent'] ?? 'XtreamPulsar/1.0',
          'Accept': '*/*',
          'Connection': 'keep-alive',
        },
      },
      (proxyRes) => {
        const headers: Record<string, string | string[] | undefined> = {
          ...proxyRes.headers,
          'X-Proxied-By': 'XtreamPulsar',
        };
        res.writeHead(proxyRes.statusCode ?? 200, headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res
          .status(HttpStatus.BAD_GATEWAY)
          .json({ error: 'Bad Gateway', message: err.message });
      }
    });

    req.pipe(proxyReq);
  }

  // ─── Live stream ───────────────────────────────────────────────────────────

  @Get('live/:username/:password/:streamId')
  async liveStream(
    @Param('username') username: string,
    @Param('password') password: string,
    @Param('streamId') streamId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.xtream.authenticate(username, password);
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
      return;
    }

    // Strip extension to get the clean numeric external ID
    const cleanId = streamId.replace(/\.(m3u8|ts)$/i, '');
    const externalId = parseInt(cleanId, 10);
    if (isNaN(externalId)) {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID');
      return;
    }

    // Validate connection limits
    try {
      const validation = await this.userService.validateConnection(
        user.id,
        (req as Request).ip ?? '',
        req.headers['user-agent'],
      );
      if (!validation.allowed) {
        res.status(HttpStatus.FORBIDDEN).send(validation.reason ?? 'Forbidden');
        return;
      }
    } catch {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Connection validation error');
      return;
    }

    // Find the stream record to get its internal ID
    let streamRecord: { id: string; primaryUrl: string };
    try {
      const found = await this.streamService.findByExternalId(externalId);
      if (!found) {
        res.status(HttpStatus.NOT_FOUND).send('Stream not found');
        return;
      }
      streamRecord = found;
    } catch {
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return;
    }

    // ── Track connection ────────────────────────────────────────────────────
    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ?? '';
    let connectionId: string | null = null;
    try {
      const conn = await this.userService.createConnection(
        user.id, streamRecord.id, clientIp, req.headers['user-agent'],
      );
      connectionId = conn.id;
    } catch { /* non-fatal: don't block streaming on connection tracking */ }

    const closeConn = (): void => {
      if (!connectionId) return;
      const id = connectionId;
      connectionId = null;
      void this.userService.closeConnection(id);
    };
    res.on('close', closeConn);
    res.on('finish', closeConn);

    // ── Local HLS mode: serve pre-transcoded segments ───────────────────────
    const hlsBase = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
    const hlsFile = path.join(hlsBase, streamRecord.id, 'index.m3u8');

    if (fs.existsSync(hlsFile)) {
      const serverUrl = (process.env.SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const raw = fs.readFileSync(hlsFile, 'utf-8');

      // Rewrite relative .ts segment names to absolute URLs.
      // Append ?token=connectionId so segment requests can heartbeat the connection.
      const tokenSuffix = connectionId ? `?token=${connectionId}` : '';
      const fixed = raw.replace(
        /^([^#\r\n][^\r\n]*\.ts)$/gm,
        `${serverUrl}/hls/${streamRecord.id}/$1${tokenSuffix}`,
      );

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(fixed);
      return;
    }

    // ── Fallback: proxy to upstream source URL ──────────────────────────────
    let sourceUrl: string;
    try {
      sourceUrl = await this.streamService.getStreamUrl(externalId);
    } catch {
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return;
    }
    this.proxyToUpstream(sourceUrl, req, res);
  }

  // ─── HLS segment serve ─────────────────────────────────────────────────────

  @Get('hls/:streamId/:segment')
  serveHlsSegment(
    @Param('streamId') streamId: string,
    @Param('segment') segment: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): void {
    // Guard against path traversal
    const safeSegment = path.basename(segment);
    const hlsBase = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
    const segmentFile = path.join(hlsBase, streamId, safeSegment);

    if (!fs.existsSync(segmentFile)) {
      res.status(HttpStatus.NOT_FOUND).send('Segment not found');
      return;
    }

    // Heartbeat: refresh connection updatedAt so analytics can detect live viewers
    if (token) {
      void this.prisma.connection.update({
        where: { id: token },
        data: { updatedAt: new Date() },
      }).catch(() => { /* stale token — ignore */ });
    }

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(segmentFile);
  }

  // ─── VOD ───────────────────────────────────────────────────────────────────

  @Get('movie/:username/:password/:streamId')
  async vodStream(
    @Param('username') username: string,
    @Param('password') password: string,
    @Param('streamId') streamId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mp4|mkv|avi',
    );
    if (!url) return;
    this.proxyToUpstream(url, req, res);
  }

  // ─── Series ────────────────────────────────────────────────────────────────

  @Get('series/:username/:password/:streamId')
  async seriesStream(
    @Param('username') username: string,
    @Param('password') password: string,
    @Param('streamId') streamId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mkv|mp4|avi',
    );
    if (!url) return;
    this.proxyToUpstream(url, req, res);
  }
}
