import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WatchFolderService } from './watch-folder.service';
import { WatchFolderController } from './watch-folder.controller';
import { WatchMediaController } from './watch-media.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MetadataModule } from '../metadata/metadata.module';

@Module({
  imports: [ScheduleModule, PrismaModule, MetadataModule],
  controllers: [WatchFolderController, WatchMediaController],
  providers: [WatchFolderService],
  exports: [WatchFolderService],
})
export class WatchFolderModule {}
