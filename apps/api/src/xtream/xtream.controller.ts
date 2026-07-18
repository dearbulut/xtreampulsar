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
import { RestreamDetectorService } from '../security/restream-detector.service';
import { LoadBalancerService } from '../server/load-balancer.service';
import { GuardConfigService } from '../server/guard-config.service';
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

  // Xtream kimlik brute-force koruması (Redis, yalnız başarısız auth sayılır)
  private readonly XBRUTE_MAX = 20;      // pencere içi izinli başarısız deneme
  private readonly XBRUTE_WINDOW = 900;  // sn (15dk)
  private readonly XBRUTE_BLOCK = 1800;  // sn (30dk blok)
  private readonly SCAN_MAX = 30;        // pencere içi izinli geçersiz stream-ID
  private readonly SCAN_WINDOW = 300;    // sn (5dk)

  constructor(
    private readonly xtream: XtreamService,
    private readonly streamService: StreamService,
    private readonly userService: UserService,
    private readonly userActivityService: UserActivityService,
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly restreamDetector: RestreamDetectorService,
    private readonly lbService: LoadBalancerService,
    private readonly guardConfig: GuardConfigService,
    @Optional() private readonly prefetchService: StreamPrefetchService,
    @Optional() private readonly workerService: StreamWorkerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly gateway?: EventsGateway,
    @Optional() private readonly webhookService?: WebhookService,
  ) {}

  // ─── Xtream brute-force koruması ────────────────────────────────────────────

  private clientIpOf(req: Request): string {
    const real = (req.headers['x-real-ip'] as string | undefined)?.trim();
    if (real) return real;
    const xff = req.headers['x-forwarded-for'] as string | undefined;
    if (xff) return xff.split(',').pop()!.trim(); // son hop = nginx'in eklediği gerçek IP
    return req.ip ?? '';
  }

  private async isXtreamBlocked(ip: string): Promise<boolean> {
    if (!ip) return false;
    return !!(await this.redis.get(`xbrute:block:${ip}`).catch(() => null));
  }

  private async recordXtreamFail(ip: string): Promise<void> {
    if (!ip) return;
    const key = `xbrute:fail:${ip}`;
    const n = await this.redis.incr(key).catch(() => 0);
    if (n === 1) await this.redis.expire(key, this.XBRUTE_WINDOW).catch(() => {});
    if (n >= this.XBRUTE_MAX) {
      await this.redis.set(`xbrute:block:${ip}`, '1', 'EX', this.XBRUTE_BLOCK).catch(() => {});
      await this.redis.del(key).catch(() => {});
      this.logger.warn(`Xtream brute-force block: ${ip} (${n} fails)`);
    }
  }

  private async recordInvalidStreamId(ip: string): Promise<void> {
    if (!ip) return;
    const key = `scan:invalid:${ip}`;
    const n = await this.redis.incr(key).catch(() => 0);
    if (n === 1) await this.redis.expire(key, this.SCAN_WINDOW).catch(() => {});
    if (n >= this.SCAN_MAX) {
      await this.redis.set(`xbrute:block:${ip}`, '1', 'EX', this.XBRUTE_BLOCK).catch(() => {});
      await this.redis.del(key).catch(() => {});
      this.logger.warn(`Stream-ID scanner block: ${ip} (${n} invalid IDs)`);
    }
  }

  // ─── Authentication + action dispatch ──────────────────────────────────────

  @Get('player_api.php')
  async playerApi(
    @Query() query: PlayerApiQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { username = '', password = '', action } = query;

    const ip = this.clientIpOf(req);
    if (await this.isXtreamBlocked(ip)) {
      res.json({ user_info: { auth: 0, message: 'Too many failed attempts. Try later.' }, server_info: await this.xtream.buildServerInfo() });
      return;
    }

    const user = await this.xtream.authenticate(username, password);

    if (!user) {
      await this.recordXtreamFail(ip);
      res.json({
        user_info: {
          auth: 0,
          message: 'Invalid username or password',
        },
        server_info: await this.xtream.buildServerInfo(),
      });
      return;
    }

    if (!action) {
      const loginIp = this.clientIpOf(req);
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

      case 'get_series_info': {
        const sid = parseInt(query.series_id ?? '', 10);
        if (isNaN(sid)) { res.status(400).json({ error: 'series_id required' }); break; }
        res.json(await this.xtream.getSeriesInfo(sid));
        break;
      }

      case 'get_vod_info': {
        const vid = parseInt(query.vod_id ?? '', 10);
        if (isNaN(vid)) { res.status(400).json({ error: 'vod_id required' }); break; }
        res.json(await this.xtream.getVodInfo(vid));
        break;
      }

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
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { username = '', password = '', type = 'm3u_plus', output = 'm3u8' } = query;

    const ip = this.clientIpOf(req);
    if (await this.isXtreamBlocked(ip)) { res.status(429).send('Too many failed attempts'); return; }

    const user = await this.xtream.authenticate(username, password);
    if (!user) {
      await this.recordXtreamFail(ip);
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
  ): Promise<{ url: string; userId: string; streamId: string } | null> {
    const user = await this.xtream.authenticate(username, password);
    if (!user) {
      res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
      return null;
    }

    // Guard config'i çöz + whitelist bypass (yalnız anti-restream kontrollerini atlar).
    const guard = await this.guardConfig.getEffective();
    const ip = this.clientIpOf(res.req as Request);
    const wl = guard.whitelistIps.includes(ip) || guard.whitelistUsernames.includes(username);

    const ext = new RegExp(`\\.(${extension})$`, 'i');
    const externalId = parseInt(rawStreamId.replace(ext, ''), 10);
    if (isNaN(externalId)) {
      if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(ip);
      res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID');
      return null;
    }

    try {
      const validation = await this.userService.validateConnection(
        user.id,
        ip,
        (res.req as Request).headers['user-agent'],
        wl ? 0 : guard.maxConnsPerIp,
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

      // Internal stream kaydını çöz (connection-tracking için streamId gerekli).
      const rec = await this.streamService.findByExternalId(externalId);
      if (!rec) {
        if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(ip);
        res.status(HttpStatus.NOT_FOUND).send('Stream not found');
        return null;
      }

      const url = await this.streamService.getStreamUrl(externalId);
      void this.restreamDetector.record({
        userId: user.id, username: user.username, ip,
        maxConnections: user.maxConnections ?? 1, guard,
      }).catch(() => {});
      return { url, userId: user.id, streamId: rec.id };
    } catch {
      if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(ip);
      res.status(HttpStatus.NOT_FOUND).send('Stream not found');
      return null;
    }
  }

  // HLS playlist (m3u8) içindeki URL'leri panel proxy path'ine yeniden yazar.
  // - Yorum/tag satırları korunur; URI="..." içeren tag'lar (EXT-X-KEY/MAP/MEDIA)
  //   ve düz URL satırları (variant/segment) rewrite edilir.
  // - Göreli/mutlak URL upstream playlist'e göre çözülür; yalnız AYNI origin'e ait
  //   olanlar panel proxy'sine yönlendirilir (farklı CDN origin'i olduğu gibi kalır).
  // - proxyPrefix = /live/<user>/<pass>/<externalId>; alt-yol upstream pathname'idir
  //   → route liveProxySub bunu güvenle (sabit origin) tekrar upstream'e çözer.
  private rewritePlaylist(content: string, playlistUrl: string, upstreamOrigin: string, proxyPrefix: string): string {
    const rewriteOne = (uri: string): string => {
      const u = uri.trim();
      if (!u) return uri;
      try {
        const abs = new URL(u, playlistUrl);
        if (abs.origin !== upstreamOrigin) return uri; // farklı origin — dokunma
        return `${proxyPrefix}${abs.pathname}${abs.search}`;
      } catch {
        return uri;
      }
    };
    return content
      .split(/\r?\n/)
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) {
          const m = t.match(/URI="([^"]*)"/);
          if (m && m[1]) return line.replace(m[1], rewriteOne(m[1]));
          return line;
        }
        return rewriteOne(t);
      })
      .join('\n');
  }

  private proxyToUpstream(
    streamUrl: string,
    req: Request,
    res: Response,
    opts?: {
      onEnd?: (bytes: bigint, durationSeconds: number) => void;
      onHeartbeat?: () => void;
      rewrite?: { proxyPrefix: string; upstreamOrigin: string; playlistUrl: string };
    },
  ): void {
    const onEnd = opts?.onEnd;
    const onHeartbeat = opts?.onHeartbeat;
    const startMs = Date.now();
    let bytes = BigInt(0);
    let lastHb = 0;

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
          // Rewrite için gzip'siz düz metin iste (buffer + parse edilebilsin).
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive',
        },
      },
      (proxyRes) => {
        const ct = String(proxyRes.headers['content-type'] ?? '');
        const isPlaylist = !!opts?.rewrite && (/mpegurl/i.test(ct) || /\.m3u8($|\?)/i.test(target.pathname + target.search));

        if (isPlaylist) {
          // Playlist: tamamını topla → URL'leri rewrite et → yeni Content-Length ile gönder.
          const chunks: Buffer[] = [];
          proxyRes.on('data', (c: Buffer) => chunks.push(c));
          proxyRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            const rw = opts!.rewrite!;
            const out = Buffer.from(this.rewritePlaylist(body, rw.playlistUrl, rw.upstreamOrigin, rw.proxyPrefix), 'utf-8');
            if (res.headersSent) return;
            res.writeHead(proxyRes.statusCode ?? 200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Content-Length': out.length,
              'Cache-Control': 'no-cache, no-store',
              'Access-Control-Allow-Origin': '*',
              'X-Proxied-By': 'XtreamPulsar',
            });
            res.end(out);
          });
          proxyRes.on('error', () => { if (!res.headersSent) res.status(HttpStatus.BAD_GATEWAY).end(); });
          return;
        }

        // Segment/binary: ham pipe (performans). onEnd → bayt sayacı; onHeartbeat →
        // ≥30sn'de bir bağlantıyı canlı tut (uzun VOD/series tek proxy'de stale-cron'a karşı).
        if (onEnd || onHeartbeat) {
          proxyRes.on('data', (chunk: Buffer) => {
            if (onEnd) bytes += BigInt(chunk.length);
            if (onHeartbeat) {
              const t = Date.now();
              if (t - lastHb > 30000) { lastHb = t; onHeartbeat(); }
            }
          });
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

    proxyReq.end();
  }

  // VOD/series oynatımı için bağlantı yaşam döngüsü sarmalayıcı: açılışta bağlantı
  // oluştur (per-IP/per-user cap'e sayılsın + "aktif bağlantılar"da görünsün + kick
  // edilebilsin), heartbeat ile canlı tut (uzun tek proxy stale-cron'a takılmasın),
  // res kapanınca kapat. STREAM_START/END aktivite log'u da burada üretilir.
  private async proxyWithConnection(
    streamUrl: string,
    req: Request,
    res: Response,
    ctx: { userId: string; streamId: string; ip: string; ua: string },
  ): Promise<void> {
    let connId: string | null = null;
    try {
      const conn = await this.userService.findOrCreateConnection(ctx.userId, ctx.streamId, ctx.ip, ctx.ua);
      connId = conn.id;
      if (conn.isNew) {
        this.gateway?.emitConnectionUpdate({
          id: conn.id,
          userId: ctx.userId,
          streamId: ctx.streamId,
          ip: ctx.ip,
          startedAt: new Date().toISOString(),
        });
      }
    } catch { /* non-fatal */ }

    void this.userActivityService.logActivity({
      userId: ctx.userId,
      action: 'STREAM_START',
      streamId: ctx.streamId,
      ip: ctx.ip,
      userAgent: ctx.ua,
      deviceType: this.userActivityService.detectDeviceType(ctx.ua),
    });

    this.proxyToUpstream(streamUrl, req, res, {
      onHeartbeat: () => { if (connId) void this.userService.touchConnection(connId); },
      onEnd: (bytes, duration) => {
        if (connId) void this.userService.closeConnection(connId);
        void this.userActivityService.logActivity({
          userId: ctx.userId,
          action: 'STREAM_END',
          streamId: ctx.streamId,
          ip: ctx.ip,
          duration,
          bytesTransferred: bytes,
          endedAt: new Date(),
        });
      },
    });
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

    // Guard config + whitelist bypass (yalnız anti-restream kontrollerini atlar).
    const guard = await this.guardConfig.getEffective();
    const clientIpRaw = this.clientIpOf(req);
    const wl = guard.whitelistIps.includes(clientIpRaw) || guard.whitelistUsernames.includes(username);

    // IP geo/ban check
    if (!wl && await this.isXtreamBlocked(clientIpRaw)) { res.status(403).send('Access temporarily blocked'); return; }
    try {
      const ipCheck = await this.securityService.checkIpAllowed(clientIpRaw, guard.serverId ?? undefined);
      if (!ipCheck.allowed) {
        res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden');
        return;
      }
    } catch { /* non-fatal: continue on lookup error */ }

    // Strip extension to get the clean numeric external ID
    const cleanId = streamId.replace(/\.(m3u8|ts)$/i, '');
    const externalId = parseInt(cleanId, 10);
    if (isNaN(externalId)) {
      if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(clientIpRaw);
      res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID');
      return;
    }

    // Find the stream record to get its internal ID and mode
    let streamRecord: { id: string; primaryUrl: string; streamMode: string };
    try {
      const found = await this.streamService.findByExternalId(externalId);
      if (!found) {
        if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(clientIpRaw);
        res.status(HttpStatus.NOT_FOUND).send('Stream not found');
        return;
      }
      streamRecord = found as typeof streamRecord;
    } catch {
      if (guard.denyInvalidStreamIds && !wl) await this.recordInvalidStreamId(clientIpRaw);
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
      const validation = await this.userService.validateConnection(user.id, clientIp, clientUa, wl ? 0 : guard.maxConnsPerIp);
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
    // NOT: Bağlantı OTURUM bazlıdır. HLS'te her istek (master/variant/segment) ayrı
    // ve kısa ömürlüdür; response bitişini (res 'close'/'finish') "oturum bitti"
    // sanıp kapatmak, master playlist gönderilir gönderilmez (~62ms) bağlantıyı
    // öldürüyordu. Kapatma YALNIZ stale cron (90sn heartbeat yok), zap ve kick/ban
    // ile yapılır; alt-istekler (liveProxySub) updatedAt'i tazeleyerek canlı tutar.
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

    // Anti-restream Aşama 2: her yetkili açılışta bir kez (isNew dışında). Fire-and-forget.
    void this.restreamDetector.record({
      userId: user.id, username: user.username, ip: clientIp,
      maxConnections: user.maxConnections ?? 1, guard,
    }).catch(() => {});

    // ── PROXY mode: upstream'i geçir; m3u8 ise içindeki URL'leri panel proxy'sine
    //    rewrite et (aksi halde upstream'in göreli variant/segment yolları VLC'de
    //    panel URL'ine göre çözülüp 404 verirdi). FFmpeg/HLS atlanır.
    if ((streamRecord.streamMode ?? 'PROXY') === 'PROXY') {
      const proxyPrefix = `/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${externalId}`;
      const upstreamOrigin = new URL(streamRecord.primaryUrl).origin;
      this.proxyToUpstream(streamRecord.primaryUrl, req, res, {
        rewrite: { proxyPrefix, upstreamOrigin, playlistUrl: streamRecord.primaryUrl },
      });
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

  // ─── PROXY alt-istekleri (variant/media playlist + segment) ─────────────────
  // liveStream'in rewrite ettiği master playlist'in alt URL'leri buraya gelir.
  // Güvenlik: hedef origin DAİMA stream'in primaryUrl origin'i (DB'den, sabit);
  // wildcard yalnız PATH taşır → keyfi host'a proxy (SSRF) imkânsız, ham ?url= yok.
  // Auth zinciri korunur: authenticate + subscription (C2) + bouquet (C4) burada da.
  @Get('live/:username/:password/:streamId/*')
  async liveProxySub(
    @Param('username') username: string,
    @Param('password') password: string,
    @Param('streamId') streamId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.xtream.authenticate(username, password);
    if (!user) { res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized'); return; }

    const access = await this.userService.checkSubscriptionActive(user.id);
    if (!access.allowed) { res.status(HttpStatus.FORBIDDEN).send(access.reason ?? 'Forbidden'); return; }

    const cleanId = streamId.replace(/\.(m3u8|ts)$/i, '');
    const externalId = parseInt(cleanId, 10);
    if (isNaN(externalId)) { res.status(HttpStatus.BAD_REQUEST).send('Invalid stream ID'); return; }

    const stream = await this.streamService.findByExternalId(externalId);
    if (!stream) { res.status(HttpStatus.NOT_FOUND).send('Stream not found'); return; }

    // C4: bouquet zorlaması alt-isteklerde de geçerli.
    if (user.role !== 'ADMIN' && user.role !== 'RESELLER') {
      const canAccess = await this.streamService.canUserAccessStream(user.id, { streamId: stream.id });
      if (!canAccess) { res.status(HttpStatus.FORBIDDEN).send('Bu kanal paketinizde mevcut değil'); return; }
    }

    const upstreamOrigin = new URL(stream.primaryUrl).origin;
    const rest = String((req.params as Record<string, string>)[0] ?? '');
    const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    let target: string;
    try {
      target = new URL(`/${rest}${search}`, upstreamOrigin).toString();
    } catch {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid path');
      return;
    }

    // Heartbeat + oturum yetkisi: açık bağlantının updatedAt'ini tazele. count===0 ise
    // kullanıcının bu stream için AÇIK bağlantısı yoktur — kick/ban/softDelete/reseller-kick
    // hepsi endedAt=now yazarak bağlantıyı kapattığından, sonraki playlist/segment
    // isteklerini REDDET (aksi halde PROXY yayını kesintisiz akmaya devam ediyordu).
    // TRANSCODE'daki serveHlsSegment de aynı prensibi (validateSegmentToken → endedAt IS
    // NULL) kullanır; iki yol tutarlı, ayrı blacklist gerekmez.
    const beat = await this.prisma.connection
      .updateMany({
        where: { userId: user.id, streamId: stream.id, endedAt: null },
        data: { updatedAt: new Date() },
      })
      .catch(() => ({ count: 0 }));
    if (beat.count === 0) {
      res.status(HttpStatus.FORBIDDEN).send('Session terminated');
      return;
    }

    const proxyPrefix = `/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${externalId}`;
    this.proxyToUpstream(target, req, res, {
      rewrite: { proxyPrefix, upstreamOrigin, playlistUrl: target },
    });
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
    const guard = await this.guardConfig.getEffective();
    const ip = this.clientIpOf(req);
    const wl = guard.whitelistIps.includes(ip) || guard.whitelistUsernames.includes(username);
    if (!wl && await this.isXtreamBlocked(ip)) { res.status(403).send('Access temporarily blocked'); return; }
    try {
      const ipCheck = await this.securityService.checkIpAllowed(ip, guard.serverId ?? undefined);
      if (!ipCheck.allowed) { res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden'); return; }
    } catch { /* non-fatal */ }

    const result = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mp4|mkv|avi',
    );
    if (!result) return;

    const ua = req.headers['user-agent'] ?? '';
    await this.proxyWithConnection(result.url, req, res, {
      userId: result.userId, streamId: result.streamId, ip, ua,
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
    const guard = await this.guardConfig.getEffective();
    const ip = this.clientIpOf(req);
    const wl = guard.whitelistIps.includes(ip) || guard.whitelistUsernames.includes(username);
    if (!wl && await this.isXtreamBlocked(ip)) { res.status(403).send('Access temporarily blocked'); return; }
    try {
      const ipCheck = await this.securityService.checkIpAllowed(ip, guard.serverId ?? undefined);
      if (!ipCheck.allowed) { res.status(HttpStatus.FORBIDDEN).send(ipCheck.reason ?? 'Forbidden'); return; }
    } catch { /* non-fatal */ }

    // Önce episode olarak çöz (yoksa aşağıdaki legacy tek-stream fallback devam eder)
    const cleanEp = streamId.replace(/\.(mkv|mp4|avi)$/i, '');
    const epExtId = parseInt(cleanEp, 10);
    if (!isNaN(epExtId)) {
      const episode = await this.streamService.findEpisodeByExternalId(epExtId);
      if (episode) {
        const user = await this.xtream.authenticate(username, password);
        if (!user) { res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized'); return; }
        const access = await this.userService.checkSubscriptionActive(user.id);
        if (!access.allowed) { res.status(HttpStatus.FORBIDDEN).send(access.reason ?? 'Forbidden'); return; }
        if (user.role !== 'ADMIN' && user.role !== 'RESELLER') {
          const canAccess = await this.streamService.canUserAccessStream(user.id, { streamId: episode.seriesId });
          if (!canAccess) { res.status(HttpStatus.FORBIDDEN).send('Bu içerik paketinizde mevcut değil'); return; }
        }
        const ua = req.headers['user-agent'] ?? '';
        // Episode path'te cap enforce edilmiyordu — VOD/live ile aynı per-IP/user tavanını uygula.
        const validation = await this.userService.validateConnection(user.id, ip, ua, wl ? 0 : guard.maxConnsPerIp);
        if (!validation.allowed) { res.status(HttpStatus.FORBIDDEN).send(validation.reason ?? 'Forbidden'); return; }
        await this.proxyWithConnection(episode.primaryUrl, req, res, {
          userId: user.id, streamId: episode.seriesId, ip, ua,
        });
        return;
      }
    }

    const result = await this.authorizeAndGetUrl(
      username, password, streamId, res, 'mkv|mp4|avi',
    );
    if (!result) return;

    const ua = req.headers['user-agent'] ?? '';
    await this.proxyWithConnection(result.url, req, res, {
      userId: result.userId, streamId: result.streamId, ip, ua,
    });
  }
}
