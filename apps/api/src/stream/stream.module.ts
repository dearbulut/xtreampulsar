import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamWorkerService } from './stream-worker.service';
import { StreamHealthService } from './stream-health.service';
import { StreamQualityService } from './stream-quality.service';
import { StreamPrefetchService } from './stream-prefetch.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, GatewayModule, NotificationModule, ScheduleModule],
  controllers: [StreamController],
  providers: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService, StreamPrefetchService],
  exports: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService, StreamPrefetchService],
})
export class StreamModule {}
