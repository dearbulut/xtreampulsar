import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { YouTubeService } from './youtube.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('youtube')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('ADMIN')
export class YouTubeController {
  constructor(private readonly youtube: YouTubeService) {}

  @Post('resolve')
  @RequirePermission('streams.create')
  resolve(@Body() body: { url: string }) {
    return this.youtube.resolve(body.url);
  }

  @Post('import')
  @RequirePermission('streams.create')
  importStream(@Body() body: { url: string; categoryId: string; name?: string; streamMode?: string }) {
    return this.youtube.importStream(body);
  }
}
