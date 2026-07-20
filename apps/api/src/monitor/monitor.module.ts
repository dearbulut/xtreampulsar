import { Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [MonitorController],
  providers: [MonitorService],
  exports: [MonitorService],
})
export class MonitorModule {}
