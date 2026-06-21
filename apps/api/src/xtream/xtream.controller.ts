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
import { URL } from 'url';
import { XtreamService } from './xtream.service';
import { StreamService } from '../stream/stream.service';
import { UserService } from '../user/user.service';

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
    const url = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'm3u8|ts',
    );
    if (!url) return;
    this.proxyToUpstream(url, req, res);
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
