import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { CatchupService } from './catchup.service';
import { CatchupController } from './catchup.controller';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [CatchupController],
  providers: [CatchupService],
  exports: [CatchupService],
})
export class CatchupModule {}
