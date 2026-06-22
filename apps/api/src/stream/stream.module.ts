import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamWorkerService } from './stream-worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [StreamController],
  providers: [StreamService, StreamWorkerService],
  exports: [StreamService, StreamWorkerService],
})
export class StreamModule {}
