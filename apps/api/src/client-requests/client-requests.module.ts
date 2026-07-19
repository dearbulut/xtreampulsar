import { Module } from '@nestjs/common';
import { ClientRequestsController } from './client-requests.controller';
import { ClientRequestsService } from './client-requests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ClientRequestsController],
  providers: [ClientRequestsService],
})
export class ClientRequestsModule {}
