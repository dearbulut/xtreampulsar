import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
