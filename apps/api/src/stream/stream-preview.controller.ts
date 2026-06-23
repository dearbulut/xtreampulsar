import * as http from 'http';
import * as https from 'https';
import { Controller, Get, Inject, Param, Req, Res, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('streams/preview')
export class StreamPreviewController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get(':token')
  async preview(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const raw = await this.redis.get(`preview:${token}`);
    if (!raw) {
      res.status(HttpStatus.NOT_FOUND).send('Preview token expired or not found');
      return;
    }

    const { primaryUrl } = JSON.parse(raw) as { primaryUrl: string };

    let target: URL;
    try {
      target = new URL(primaryUrl);
    } catch {
      res.status(HttpStatus.BAD_GATEWAY).send('Invalid stream URL');
      return;
    }

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
          Accept: '*/*',
          Connection: 'keep-alive',
        },
      },
      (proxyRes) => {
        const headers: Record<string, string | string[] | undefined> = {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*',
          'X-Proxied-By': 'XtreamPulsar',
        };
        res.writeHead(proxyRes.statusCode ?? 200, headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_GATEWAY).json({ error: 'Bad Gateway', message: err.message });
      }
    });

    req.pipe(proxyReq);
  }
}
