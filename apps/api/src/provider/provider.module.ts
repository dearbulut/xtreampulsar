import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ScheduleModule, PrismaModule],
  controllers: [ProviderController],
  providers: [ProviderService],
  exports: [ProviderService],
})
export class ProviderModule {}
