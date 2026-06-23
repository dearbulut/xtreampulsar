import * as http from 'http';
import * as https from 'https';
import { Controller, Get, Inject, Param, Query, Req, Res, HttpStatus } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('streams/preview')
export class StreamPreviewController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private async resolveToken(token: string): Promise<string | null> {
    const raw = await this.redis.get(`preview:${token}`);
    if (!raw) return null;
    return (JSON.parse(raw) as { primaryUrl: string }).primaryUrl;
  }

  // Rewrites every non-comment, non-empty line in the playlist to go through the segment proxy.
  // Both relative paths and absolute URLs are handled.
  private rewriteM3u8(body: string, upstreamBase: string, token: string): string {
    return body
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absolute: string;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          absolute = trimmed;
        } else {
          try {
            absolute = new URL(trimmed, upstreamBase).href;
          } catch {
            return line;
          }
        }

        return `/api/v1/streams/preview/${token}/segment?url=${encodeURIComponent(absolute)}`;
      })
      .join('\n');
  }

  private fetchAndRespond(
    upstreamUrl: string,
    token: string,
    req: Request,
    res: Response,
  ): void {
    let target: URL;
    try {
      target = new URL(upstreamUrl);
    } catch {
      res.status(HttpStatus.BAD_GATEWAY).send('Invalid upstream URL');
      return;
    }

    const client = target.protocol === 'https:' ? https : http;
    const port = target.port
      ? parseInt(target.port, 10)
      : target.protocol === 'https:'
        ? 443
        : 80;

    const upstreamReq = client.request(
      {
        hostname: target.hostname,
        port,
        path: target.pathname + target.search,
        method: 'GET',
        headers: {
          'User-Agent': req.headers['user-agent'] ?? 'XtreamPulsar/1.0',
          Accept: '*/*',
          Connection: 'keep-alive',
        },
      },
      (upstreamRes: IncomingMessage) => {
        const contentType = (upstreamRes.headers['content-type'] ?? '').toLowerCase();
        const isPlaylist =
          contentType.includes('mpegurl') ||
          upstreamUrl.includes('.m3u8') ||
          contentType.includes('x-mpegURL');

        if (isPlaylist) {
          const chunks: Buffer[] = [];
          upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          upstreamRes.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            const rewritten = this.rewriteM3u8(body, upstreamUrl, token);
            res.writeHead(upstreamRes.statusCode ?? 200, {
              'Content-Type': 'application/vnd.apple.mpegurl',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store',
              'X-Proxied-By': 'XtreamPulsar',
            });
            res.end(rewritten);
          });
        } else {
          const headers: Record<string, string | string[] | undefined> = {
            ...upstreamRes.headers,
            'Access-Control-Allow-Origin': '*',
            'X-Proxied-By': 'XtreamPulsar',
          };
          res.writeHead(upstreamRes.statusCode ?? 200, headers);
          upstreamRes.pipe(res);
        }
      },
    );

    upstreamReq.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_GATEWAY).json({ error: 'Bad Gateway', message: err.message });
      }
    });

    upstreamReq.end();
  }

  // Segment proxy — must be declared before :token to avoid route shadowing
  @Get(':token/segment')
  async proxySegment(
    @Param('token') token: string,
    @Query('url') encodedUrl: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const primaryUrl = await this.resolveToken(token);
    if (!primaryUrl) {
      res.status(HttpStatus.NOT_FOUND).send('Preview token expired or not found');
      return;
    }

    if (!encodedUrl) {
      res.status(HttpStatus.BAD_REQUEST).send('Missing url parameter');
      return;
    }

    let segmentUrl: string;
    try {
      segmentUrl = decodeURIComponent(encodedUrl);
      new URL(segmentUrl); // throws if invalid
    } catch {
      res.status(HttpStatus.BAD_REQUEST).send('Invalid segment URL');
      return;
    }

    this.fetchAndRespond(segmentUrl, token, req, res);
  }

  // Main playlist proxy — rewrites m3u8 content, pipes binary data
  @Get(':token')
  async proxyPlaylist(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const primaryUrl = await this.resolveToken(token);
    if (!primaryUrl) {
      res.status(HttpStatus.NOT_FOUND).send('Preview token expired or not found');
      return;
    }

    this.fetchAndRespond(primaryUrl, token, req, res);
  }
}
