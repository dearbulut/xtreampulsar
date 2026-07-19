import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tools')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  // POST /tools/fix-users-output
  @Post('fix-users-output')
  fixUsersOutput() {
    return this.toolsService.fixUsersOutput();
  }

  // POST /tools/streams-to-json
  @Post('streams-to-json')
  streamsToJson(@Body() body: { streamType?: string }) {
    const streamType = body.streamType as
      | 'LIVE'
      | 'VOD'
      | 'SERIES'
      | 'ALL'
      | undefined;
    return this.toolsService.streamsToJson(streamType);
  }

  // POST /tools/set-stream-server
  @Post('set-stream-server')
  setStreamServer(
    @Body()
    body: {
      serverId: string;
      streamIds: string[] | 'all';
      streamType: 'LIVE' | 'VOD' | 'SERIES' | 'ALL';
    },
  ) {
    return this.toolsService.setStreamServer(
      body.serverId,
      body.streamIds,
      body.streamType,
    );
  }

  // POST /tools/clean-database
  @Post('clean-database')
  cleanDatabase(@Body() body: { targets: string[] }) {
    return this.toolsService.cleanDatabase(body.targets);
  }

  // POST /tools/restart-all-streams
  @Post('restart-all-streams')
  restartAllStreams() {
    return this.toolsService.restartAllStreams();
  }

  // POST /tools/reencode-vods
  @Post('reencode-vods')
  reencodeVods(
    @Body()
    body: {
      categoryId?: string;
      serverId?: string;
      mode: 'all' | 'category' | 'by_server' | 'down_only' | 'ready_only';
    },
  ) {
    return this.toolsService.reencodeVods(body);
  }

  // POST /tools/probe-vod-durations
  @Post('probe-vod-durations')
  probeVodDurations(@Body('limit') limit?: number) {
    return this.toolsService.probeVodDurations(limit ?? 200);
  }

  // POST /tools/bulk-series-import
  @Post('bulk-series-import')
  bulkSeriesImport(
    @Body()
    body: {
      categoryId: string;
      folderPath: string;
      specialCharEncoding: boolean;
    },
  ) {
    return this.toolsService.bulkSeriesImport(
      body.categoryId,
      body.folderPath,
      body.specialCharEncoding,
    );
  }

  // GET /tools/system-stats
  @Get('system-stats')
  systemStats() {
    return this.toolsService.systemStats();
  }

  // POST /tools/iptv-check
  @Post('iptv-check')
  iptvCheck(@Body() body: { host: string; username: string; password: string }) {
    return this.toolsService.iptvCheck(body.host, body.username, body.password);
  }
}
