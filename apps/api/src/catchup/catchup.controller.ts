import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CatchupService } from './catchup.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('catchup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CatchupController {
  constructor(private readonly catchupService: CatchupService) {}

  @Get(':streamId/info')
  info(@Param('streamId') streamId: string) {
    return this.catchupService.getArchiveInfo(streamId);
  }
}
