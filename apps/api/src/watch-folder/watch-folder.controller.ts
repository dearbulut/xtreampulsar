import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WatchFolderService } from './watch-folder.service';
import { WatchConfigDto } from './dto/watch-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('watch-folder')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WatchFolderController {
  constructor(private readonly service: WatchFolderService) {}

  @Get('config')
  config() {
    return this.service.getConfig();
  }

  @Patch('config')
  update(@Body() dto: WatchConfigDto) {
    return this.service.updateConfig(dto);
  }

  @Post('scan')
  scan() {
    return this.service.scanNow();
  }

  @Get('imports')
  imports(@Query('limit') limit?: string) {
    return this.service.imports(limit ? Number(limit) : undefined);
  }
}
