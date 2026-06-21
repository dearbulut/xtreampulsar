import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { ServerHealthService } from './server-health.service';

@Module({
  imports: [HttpModule],
  controllers: [ServerController],
  providers: [ServerService, ServerHealthService],
  exports: [ServerService, ServerHealthService],
})
export class ServerModule {}
