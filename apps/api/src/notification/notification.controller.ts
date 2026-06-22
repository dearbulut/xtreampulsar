import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('logs')
  getLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.notificationService.getLogs(
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 200) : 50,
    );
  }

  @Post('test')
  sendTest() {
    return this.notificationService.testEmail();
  }
}
