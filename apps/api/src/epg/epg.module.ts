import { Module } from '@nestjs/common';
import { EpgController } from './epg.controller';
import { EpgService } from './epg.service';
import { EpgParserService } from './epg-parser.service';

@Module({
  controllers: [EpgController],
  providers: [EpgService, EpgParserService],
  exports: [EpgService, EpgParserService],
})
export class EpgModule {}
