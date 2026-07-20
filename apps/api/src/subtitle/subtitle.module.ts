import { Module } from '@nestjs/common';
import { SubtitleService } from './subtitle.service';
import { SubtitleController } from './subtitle.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubtitleController],
  providers: [SubtitleService],
  exports: [SubtitleService],
})
export class SubtitleModule {}
