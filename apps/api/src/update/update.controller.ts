import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UpdateService } from './update.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('update')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Get('check')
  checkUpdate() {
    return this.updateService.checkUpdate();
  }

  @Post('apply')
  applyUpdate() {
    return this.updateService.applyUpdate();
  }
}
