import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { StreamWorkerService } from './stream-worker.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StreamController],
  providers: [StreamService, StreamWorkerService],
  exports: [StreamService, StreamWorkerService],
})
export class StreamModule {}
