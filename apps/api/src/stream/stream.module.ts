import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamPreviewController } from './stream-preview.controller';
import { StreamWorkerService } from './stream-worker.service';
import { StreamHealthService } from './stream-health.service';
import { StreamQualityService } from './stream-quality.service';
import { StreamPrefetchService } from './stream-prefetch.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, GatewayModule, NotificationModule, ScheduleModule, RedisModule],
  controllers: [StreamController, StreamPreviewController],
  providers: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService, StreamPrefetchService],
  exports: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService, StreamPrefetchService],
})
export class StreamModule {}
