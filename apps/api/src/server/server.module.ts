import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { ServerHealthService } from './server-health.service';
import { ServerGuardController } from './server-guard.controller';
import { ServerGuardService } from './server-guard.service';

@Module({
  imports: [HttpModule],
  controllers: [ServerController, ServerGuardController],
  providers: [ServerService, ServerHealthService, ServerGuardService],
  exports: [ServerService, ServerHealthService],
})
export class ServerModule {}
