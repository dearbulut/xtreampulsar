import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { M3uSyncController } from './m3u-sync.controller';
import { M3uSyncService } from './m3u-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MigrationModule } from '../migration/migration.module';

@Module({
  imports: [ScheduleModule, PrismaModule, MigrationModule],
  controllers: [M3uSyncController],
  providers: [M3uSyncService],
})
export class M3uSyncModule {}
