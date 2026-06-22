import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { MetadataService } from './metadata.service';
import { MetadataController } from './metadata.controller';

@Module({
  imports: [HttpModule, ScheduleModule],
  controllers: [MetadataController],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
