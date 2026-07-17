import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { EpisodeService } from './episode.service';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('streams/:seriesId/episodes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EpisodeController {
  constructor(private readonly episodeService: EpisodeService) {}

  @Get()
  list(@Param('seriesId') seriesId: string) {
    return this.episodeService.list(seriesId);
  }

  @Post()
  create(@Param('seriesId') seriesId: string, @Body() dto: CreateEpisodeDto) {
    return this.episodeService.create(seriesId, dto);
  }

  @Patch(':episodeId')
  update(
    @Param('seriesId') seriesId: string,
    @Param('episodeId') episodeId: string,
    @Body() dto: UpdateEpisodeDto,
  ) {
    return this.episodeService.update(seriesId, episodeId, dto);
  }

  @Delete(':episodeId')
  remove(@Param('seriesId') seriesId: string, @Param('episodeId') episodeId: string) {
    return this.episodeService.remove(seriesId, episodeId);
  }
}
