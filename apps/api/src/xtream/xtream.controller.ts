import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  Res,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import type Redis from 'ioredis';
import { XtreamService } from './xtream.service';
import { StreamService } from '../stream/stream.service';
import { StreamPrefetchService } from '../stream/stream-prefetch.service';
import { StreamWorkerService } from '../stream/stream-worker.service';
import { UserService } from '../user/user.service';
import { UserActivityService } from '../user/user-activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { LoadBalancerService } from '../server/load-balancer.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { EventsGateway } from '../gateway/events.gateway';
import { WebhookService } from '../webhook/webhook.service';

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
@Throttle({ default: { ttl: 60000, limit: 500 } })
export class XtreamController {
  private readonly logger = new Logger(XtreamController.name);

  constructor(
    private readonly xtream: XtreamService,
    private readonly streamService: StreamService,
    private readonly userService: UserService,
    private readonly userActivityService: UserActivityService,
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly lbService: LoadBalancerService,
    @Optional() private readonly prefetchService: StreamPrefetchService,
    @Optional() private readonly workerService: StreamWorkerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly gateway?: EventsGateway,
    @Optional() private readonly webhookService?: WebhookService,
  ) {}

  // ─── Authentication + action dispatch ──────────────────────────────────────

  @Get('player_api.php')
  async playerApi(
    @Query() query: PlayerApiQuery,
    @Req() req: Request,
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
      const loginIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? '';
      const loginUa = req.headers['user-agent'] ?? '';
      void this.userActivityService.logActivity({
        userId: user.id,
        action: 'LOGIN',
        ip: loginIp,
        userAgent: loginUa,
        deviceType: this.userActivityService.detectDeviceType(loginUa),
      });
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

    // C2: expired/disabled/banned kullanıcıya playlist verme (status + expiry gate).
    const access = await this.userService.checkSubscriptionActive(user.id);
    if (!access.allowed) {
      res.status(HttpStatus.FORBIDDEN).send(access.reason ?? 'Forbidden');
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
  ): Promise<{ url: string; userId: string } | null> {
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

      // C4: paket (bouquet) zorlaması (movie/series). ADMIN/RESELLER muaf.
      if (user.role !== 'ADMIN' && user.role !== 'RESELLER') {
        const canAccess = await this.streamService.canUserAccessStream(user.id, { externalId });
        if (!canAccess) {
          res.status(HttpStatus.FORBIDDEN).send('Bu içerik paketinizde mevcut değil');
          return null;
        }
      }

      const url = await this.streamService.getStreamUrl(externalId);
      return { url, userId: user.id };
    } catch {
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return null;
    }
  }

  private proxyToUpstream(
    streamUrl: string,
    req: Request,
    res: Response,
    onEnd?: (bytes: bigint, durationSeconds: number) => void,
  ): void {
    const startMs = Date.now();
    let bytes = BigInt(0);

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
        if (onEnd) {
          proxyRes.on('data', (chunk: Buffer) => { bytes += BigInt(chunk.length); });
        }
        const headers: Record<string, string | string[] | undefined> = {
          ...proxyRes.headers,
          'X-Proxied-By': 'XtreamPulsar',
        };
        res.writeHead(proxyRes.statusCode ?? 200, headers);
        proxyRes.pipe(res);
      },
    );

    if (onEnd) {
      res.once('close', () => {
        onEnd(bytes, Math.round((Date.now() - startMs) / 1000));
      });
    }

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

    // IP geo/ban check
    const clientIpRaw =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ?? '';
    try {
      const ipCheck = await this.securityService.checkIpAllowed(clientIpRaw);
      if (!ipCheck.allowed) {
        res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden');
        return;
      }
    } catch { /* non-fatal: continue on lookup error */ }

    // Strip extension to get the clean numeric external ID
    const cleanId = streamId.replace(/\.(m3u8|ts)$/i, '');
    const externalId = parseInt(cleanId, 10);
    if (isNaN(externalId)) {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID');
      return;
    }

    // Find the stream record to get its internal ID and mode
    let streamRecord: { id: string; primaryUrl: string; streamMode: string };
    try {
      const found = await this.streamService.findByExternalId(externalId);
      if (!found) {
        res.status(HttpStatus.NOT_FOUND).send('Stream not found');
        return;
      }
      streamRecord = found as typeof streamRecord;
    } catch {
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return;
    }

    // C4: paket (bouquet) zorlaması — kullanıcı bu stream'e paketi üzerinden
    // erişebiliyor mu? ADMIN/RESELLER muaf. Aksi halde ID enumerasyonu ile
    // paket dışı kanal açılabiliyordu.
    if (user.role !== 'ADMIN' && user.role !== 'RESELLER') {
      const canAccess = await this.streamService.canUserAccessStream(user.id, { streamId: streamRecord.id });
      if (!canAccess) {
        res.status(HttpStatus.FORBIDDEN).send('Bu kanal paketinizde mevcut değil');
        return;
      }
    }

    const clientIp = clientIpRaw;
    const clientUa = req.headers['user-agent'] ?? '';

    // ZAP FIX: yeni stream açılıyor — kullanıcının DİĞER stream'lerdeki eski/aynı-cihaz
    // bağlantılarını KAPAT, sonra limiti değerlendir. Böylece kanal değiştiren cihazın
    // eski bağlantısı birikmez; farklı cihazdan taze izleyen korunur.
    try {
      await this.userService.closeSupersededConnections(user.id, streamRecord.id, clientIp, clientUa);
    } catch { /* non-fatal */ }

    // Validate connection limits (zap temizliğinden SONRA → doğru sayım)
    try {
      const validation = await this.userService.validateConnection(user.id, clientIp, clientUa);
      if (!validation.allowed) {
        res.status(HttpStatus.FORBIDDEN).send(validation.reason ?? 'Forbidden');
        return;
      }
    } catch {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Connection validation error');
      return;
    }

    // ── Track connection ────────────────────────────────────────────────────
    // findOrCreateConnection ensures one row per user+stream, not one per HLS request.
    const connStartedAt = Date.now();
    const hlsToken = randomUUID();
    let connectionId: string | null = null;
    let activeToken: string = hlsToken;
    try {
      const conn = await this.userService.findOrCreateConnection(
        user.id, streamRecord.id, clientIp, clientUa, undefined, hlsToken,
      );
      connectionId = conn.id;
      activeToken = conn.token ?? hlsToken;
      if (conn.isNew) {
        this.gateway?.emitConnectionUpdate({
          id: conn.id,
          userId: user.id,
          streamId: streamRecord.id,
          ip: clientIp,
          startedAt: new Date().toISOString(),
        });
        void this.userActivityService.logActivity({
          userId: user.id,
          action: 'STREAM_START',
          streamId: streamRecord.id,
          ip: clientIp,
          userAgent: clientUa,
          deviceType: this.userActivityService.detectDeviceType(clientUa),
        });
        void this.webhookService?.triggerWebhook('user.connected', {
          userId: user.id,
          username: user.username,
          streamId: streamRecord.id,
          ip: clientIp,
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    const closeConn = (): void => {
      if (!connectionId) return;
      const id = connectionId;
      connectionId = null;
      const durationSec = Math.round((Date.now() - connStartedAt) / 1000);
      this.gateway?.emitConnectionClose(id);
      void this.userService.closeConnection(id);
      void this.userActivityService.logActivity({
        userId: user.id,
        action: 'STREAM_END',
        streamId: streamRecord.id,
        ip: clientIp,
        duration: durationSec,
        endedAt: new Date(),
      });
      void this.webhookService?.triggerWebhook('user.disconnected', {
        userId: user.id,
        username: user.username,
        streamId: streamRecord.id,
        duration: durationSec,
      }).catch(() => {});
    };
    res.on('close', closeConn);
    res.on('finish', closeConn);

    // ── PROXY mode: pass source URL directly, skip FFmpeg/HLS entirely ──────
    if ((streamRecord.streamMode ?? 'PROXY') === 'PROXY') {
      this.proxyToUpstream(streamRecord.primaryUrl, req, res);
      return;
    }

    // ── TRANSCODE mode: serve pre-transcoded HLS segments ───────────────────
    const hlsBase = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';
    const hlsFile = path.join(hlsBase, streamRecord.id, 'index.m3u8');

    // Auto-start: if worker is idle/stopped and HLS file is absent, start it and wait up to 5s
    if (!fs.existsSync(hlsFile) && this.workerService) {
      try {
        const dbStream = await this.prisma.stream.findUnique({
          where: { id: streamRecord.id },
          select: { workerStatus: true },
        });
        if (dbStream?.workerStatus === 'IDLE' || dbStream?.workerStatus === 'STOPPED') {
          this.logger.log(`Auto-starting worker for stream ${streamRecord.id}`);
          await this.workerService.startWorker(streamRecord.id);
          // Poll up to 5 seconds (10 × 500ms) for HLS file
          for (let i = 0; i < 10; i++) {
            await new Promise<void>((r) => setTimeout(r, 500));
            if (fs.existsSync(hlsFile)) break;
          }
        }
      } catch (err) {
        this.logger.warn(`Auto-start failed for stream ${streamRecord.id}: ${(err as Error).message}`);
      }
    }

    if (!fs.existsSync(hlsFile) && this.workerService) {
      // Worker started but HLS still not ready — return 503 so player retries
      const dbStream2 = await this.prisma.stream.findUnique({
        where: { id: streamRecord.id },
        select: { workerStatus: true },
      }).catch(() => null);
      if (dbStream2?.workerStatus === 'RUNNING') {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ error: 'Stream is starting, please retry' });
        return;
      }
    }

    if (fs.existsSync(hlsFile)) {
      // Use load-balanced server IP if available, otherwise default
      const optimalServer = await this.lbService.getOptimalServer().catch(() => null);
      const baseUrl = optimalServer
        ? `http://${optimalServer.serverIp}:25461`
        : (process.env.SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '');

      const raw = fs.readFileSync(hlsFile, 'utf-8');
      const tokenSuffix = connectionId ? `?token=${activeToken}` : '';
      const fixed = raw.replace(
        /^([^#\r\n][^\r\n]*\.ts)$/gm,
        `${baseUrl}/hls/${streamRecord.id}/$1${tokenSuffix}`,
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
  async serveHlsSegment(
    @Param('streamId') streamId: string,
    @Param('segment') segment: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // C3: segment servisi geçerli, aktif bir bağlantı token'ına ZORUNLU bağlı.
    // Token yoksa reddet — token'sız serbest erişim (süresi dolmuş kullanıcının
    // manifest'i bir kez alıp segment çekmeye devam etmesi) kapatıldı.
    if (!token) {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Token required' });
      return;
    }

    // Kick blacklist: token kara listedeyse durdur.
    const kicked = await this.redis.get(`kicked:${token}`).catch(() => null);
    if (kicked) {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Connection terminated' });
      return;
    }

    // Token → aktif bağlantı → geçerli (status ACTIVE + expiresAt) kullanıcı.
    const tokenOk = await this.userService.validateSegmentToken(token);
    if (!tokenOk) {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Invalid or expired token' });
      return;
    }

    // Guard against path traversal
    const safeSegment = path.basename(segment);
    const hlsBase = process.env.HLS_OUTPUT_PATH ?? '/tmp/xtreampulsar/hls';

    // Prefer prefetch cache, fall back to HLS dir
    const cachedPath = this.prefetchService?.getCachedSegmentPath(streamId, safeSegment);
    const segmentFile = cachedPath ?? path.join(hlsBase, streamId, safeSegment);

    if (!fs.existsSync(segmentFile)) {
      res.status(HttpStatus.NOT_FOUND).send('Segment not found');
      return;
    }

    // Trigger prefetch for next segments in background
    this.prefetchService?.prefetchSegments(streamId, 3);

    // Heartbeat: refresh connection updatedAt so analytics detects live viewers.
    void this.prisma.connection
      .updateMany({ where: { token }, data: { updatedAt: new Date() } })
      .catch(() => { /* stale token — ignore */ });

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
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ?? '';
    try {
      const ipCheck = await this.securityService.checkIpAllowed(ip);
      if (!ipCheck.allowed) { res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden'); return; }
    } catch { /* non-fatal */ }

    const result = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mp4|mkv|avi',
    );
    if (!result) return;

    const ua = req.headers['user-agent'] ?? '';
    void this.userActivityService.logActivity({
      userId: result.userId, action: 'STREAM_START', ip, userAgent: ua,
      deviceType: this.userActivityService.detectDeviceType(ua),
    });
    this.proxyToUpstream(result.url, req, res, (bytes, duration) => {
      void this.userActivityService.logActivity({
        userId: result.userId, action: 'STREAM_END', ip,
        duration, bytesTransferred: bytes, endedAt: new Date(),
      });
    });
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
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip ?? '';
    try {
      const ipCheck = await this.securityService.checkIpAllowed(ip);
      if (!ipCheck.allowed) { res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden'); return; }
    } catch { /* non-fatal */ }

    const result = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mkv|mp4|avi',
    );
    if (!result) return;

    const ua = req.headers['user-agent'] ?? '';
    void this.userActivityService.logActivity({
      userId: result.userId, action: 'STREAM_START', ip, userAgent: ua,
      deviceType: this.userActivityService.detectDeviceType(ua),
    });
    this.proxyToUpstream(result.url, req, res, (bytes, duration) => {
      void this.userActivityService.logActivity({
        userId: result.userId, action: 'STREAM_END', ip,
        duration, bytesTransferred: bytes, endedAt: new Date(),
      });
    });
  }
}
