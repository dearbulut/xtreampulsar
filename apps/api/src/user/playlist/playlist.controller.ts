import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PlaylistService, CreatePlaylistDto, UpdatePlaylistDto } from './playlist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// ─── Admin routes (JWT guarded) ──────────────────────────────────────────────

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UserPlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post(':id/playlists')
  createPlaylist(@Param('id') userId: string, @Body() dto: CreatePlaylistDto) {
    return this.playlistService.createPlaylist(userId, dto);
  }

  @Get(':id/playlists')
  getUserPlaylists(@Param('id') userId: string) {
    return this.playlistService.getUserPlaylists(userId);
  }

  @Put('playlists/:id')
  updatePlaylist(@Param('id') id: string, @Body() dto: UpdatePlaylistDto) {
    return this.playlistService.updatePlaylist(id, dto);
  }

  @Delete('playlists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePlaylist(@Param('id') id: string): Promise<void> {
    await this.playlistService.deletePlaylist(id);
  }
}

// ─── Public routes (no auth) ──────────────────────────────────────────────────

@Controller('playlist')
export class PublicPlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get(':token')
  async servePlaylist(@Param('token') token: string, @Res() res: Response) {
    await this.playlistService.servePlaylist(token, res);
  }

  @Get(':token/info')
  getPlaylistInfo(@Param('token') token: string) {
    return this.playlistService.getPlaylistInfo(token);
  }
}
