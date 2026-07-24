import { Body, Controller, Get, Header, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WidgetService } from './widget.service';
import { WIDGET_EMBED_JS } from './widget.embed';

/** Kimlik doğrulaması YOK — publicKey ile korunur. Cross-origin (embed) için ACAO:*. */
@Controller('public/widgets')
export class WidgetPublicController {
  constructor(private readonly service: WidgetService) {}

  private static clientIp(req: Request): string | null {
    const strip = (v: string) => v.replace(/^::ffff:/, '').trim();
    const xr = req.headers['x-real-ip'];
    if (typeof xr === 'string' && xr) return strip(xr);
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return strip(xff.split(',')[0]);
    return req.ip ? strip(req.ip) : null;
  }

  // embed.js — :key'den ÖNCE tanımlı olmalı (route önceliği).
  @Get('embed.js')
  embed(@Res() res: Response): void {
    res.set({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    });
    res.send(WIDGET_EMBED_JS);
  }

  @Get(':key')
  @Header('Access-Control-Allow-Origin', '*')
  config(@Param('key') key: string) {
    return this.service.publicConfig(key);
  }

  @Post(':key/submit')
  @Header('Access-Control-Allow-Origin', '*')
  submit(@Param('key') key: string, @Body() body: { email?: string; packageId?: string; username?: string }, @Req() req: Request) {
    return this.service.submit(key, WidgetPublicController.clientIp(req), body ?? {});
  }
}
