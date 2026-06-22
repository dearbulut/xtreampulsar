import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamWorkerService } from './stream-worker.service';
import { StreamHealthService } from './stream-health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, GatewayModule, NotificationModule],
  controllers: [StreamController],
  providers: [StreamService, StreamWorkerService, StreamHealthService],
  exports: [StreamService, StreamWorkerService, StreamHealthService],
})
export class StreamModule {}
