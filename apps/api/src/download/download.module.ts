import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { DownloadService } from './download.service';
import { DownloadController } from './download.controller';
import { MediaController } from './media.controller';

@Module({
  imports: [PrismaModule, GatewayModule],
  controllers: [DownloadController, MediaController],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
