import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamWorkerService } from './stream-worker.service';
import { StreamHealthService } from './stream-health.service';
import { StreamQualityService } from './stream-quality.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, GatewayModule, NotificationModule],
  controllers: [StreamController],
  providers: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService],
  exports: [StreamService, StreamWorkerService, StreamHealthService, StreamQualityService],
})
export class StreamModule {}
