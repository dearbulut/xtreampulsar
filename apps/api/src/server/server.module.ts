import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { ServerHealthService } from './server-health.service';

@Module({
  imports: [HttpModule, ScheduleModule.forRoot()],
  controllers: [ServerController],
  providers: [ServerService, ServerHealthService],
  exports: [ServerService, ServerHealthService],
})
export class ServerModule {}
