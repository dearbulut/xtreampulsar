import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TranscodeService } from './transcode.service';
import { CreateTranscodeProfileDto } from './dto/create-transcode-profile.dto';
import { UpdateTranscodeProfileDto } from './dto/update-transcode-profile.dto';
import { PreviewTranscodeDto } from './dto/preview-transcode.dto';
import { AssignProfileDto } from './dto/assign-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Controller('transcode-profiles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TranscodeController {
  constructor(private readonly transcodeService: TranscodeService) {}

  // --- statik rotalar :id'den ONCE gelmeli ---

  @Get()
  @RequirePermission('streams.view')
  findAll() {
    return this.transcodeService.findAll();
  }

  @Get('options')
  @RequirePermission('streams.view')
  options() {
    return this.transcodeService.options();
  }

  @Get('codecs')
  @RequirePermission('streams.view')
  codecs() {
    return this.transcodeService.codecs();
  }

  @Post('assign')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  assign(@Body() dto: AssignProfileDto) {
    return this.transcodeService.assignToStreams(
      dto.streamIds,
      dto.profileId ?? null,
    );
  }

  @Post()
  @Roles('ADMIN')
  @RequirePermission('streams.create')
  create(@Body() dto: CreateTranscodeProfileDto) {
    return this.transcodeService.create(dto);
  }

  @Get(':id')
  @RequirePermission('streams.view')
  findOne(@Param('id') id: string) {
    return this.transcodeService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  update(@Param('id') id: string, @Body() dto: UpdateTranscodeProfileDto) {
    return this.transcodeService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RequirePermission('streams.delete')
  remove(@Param('id') id: string) {
    return this.transcodeService.remove(id);
  }

  @Post(':id/clone')
  @Roles('ADMIN')
  @RequirePermission('streams.create')
  clone(@Param('id') id: string) {
    return this.transcodeService.clone(id);
  }

  @Post(':id/default')
  @Roles('ADMIN')
  @RequirePermission('streams.edit')
  setDefault(@Param('id') id: string) {
    return this.transcodeService.setDefault(id);
  }

  /** ffmpeg komut onizlemesi — hicbir sey calistirmaz. */
  @Post(':id/preview')
  @RequirePermission('streams.view')
  preview(@Param('id') id: string, @Body() dto: PreviewTranscodeDto) {
    return this.transcodeService.preview(id, dto);
  }
}
