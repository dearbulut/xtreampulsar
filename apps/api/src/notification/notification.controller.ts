import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
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

  @Get('unread-count')
  getUnreadCount() {
    return this.notificationService.getUnreadCount();
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationService.markRead(id);
  }

  @Post('read-all')
  markAllRead() {
    return this.notificationService.markAllRead();
  }

  @Post('test')
  sendTest() {
    return this.notificationService.testEmail();
  }

  @Post('test-discord')
  testDiscord() {
    return this.notificationService.testDiscord();
  }

  @Post('test-telegram')
  testTelegram() {
    return this.notificationService.testTelegram();
  }
}
