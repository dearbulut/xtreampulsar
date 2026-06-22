import { Module } from '@nestjs/common';
import { StalkerController } from './stalker.controller';
import { StalkerService } from './stalker.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StalkerController],
  providers: [StalkerService],
})
export class StalkerModule {}
