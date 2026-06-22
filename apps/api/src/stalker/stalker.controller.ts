import { Controller, Get, Post, Query, Body, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StalkerService } from './stalker.service';

function stalkerOk(js: unknown) {
  return { js };
}

@Controller('stalker')
export class StalkerController {
  constructor(private readonly stalkerService: StalkerService) {}

  @Get('server/load.php')
  serverLoad(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Type', 'application/json');
    return stalkerOk({ tz: 'UTC', stime: new Date().toISOString(), evt_loop_timeout: 4000 });
  }

  @Get('portal.php')
  getPortal() {
    return stalkerOk('XtreamPulsar MAG Portal');
  }

  @Post('portal.php')
  @HttpCode(HttpStatus.OK)
  async portalAction(
    @Query('action') action: string,
    @Body() body: Record<string, string>,
  ) {
    const mac = body.mac ?? body.device_id ?? 'unknown';
    const page = parseInt(body.p_page ?? '1', 10);

    switch (action) {
      case 'handshake': {
        const result = await this.stalkerService.handshake(mac, body.serial_number);
        return stalkerOk({
          status: 'Active',
          msg: '',
          ...result,
          random: Math.random().toString(36).slice(2),
        });
      }

      case 'get_profile': {
        const profile = await this.stalkerService.getProfile(mac);
        return stalkerOk(profile);
      }

      case 'get_main_info': {
        const info = await this.stalkerService.getMainInfo();
        return stalkerOk(info);
      }

      case 'get_all_channels': {
        const channels = await this.stalkerService.getAllChannels(mac, page);
        return stalkerOk(channels);
      }

      case 'get_genres': {
        const genres = await this.stalkerService.getGenres();
        return stalkerOk({ total_items: genres.length, data: genres });
      }

      case 'create_link': {
        const streamId = parseInt(body.ch_id ?? '0', 10);
        const link = await this.stalkerService.createLink(mac, streamId);
        return stalkerOk({ cmd: `ffmpeg ${link}`, streamer_id: 1 });
      }

      default:
        return stalkerOk(null);
    }
  }

  @Get('server/api')
  serverApi() {
    return stalkerOk({ version: '5.6.0', servertime: Date.now() });
  }
}
