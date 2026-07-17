import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { ServerHealthService } from './server-health.service';
import { ServerGuardController } from './server-guard.controller';
import { ServerGuardService } from './server-guard.service';
import { LoadBalancerService } from './load-balancer.service';
import { GuardConfigService } from './guard-config.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [ServerController, ServerGuardController],
  providers: [ServerService, ServerHealthService, ServerGuardService, LoadBalancerService, GuardConfigService],
  exports: [ServerService, ServerHealthService, LoadBalancerService, GuardConfigService],
})
export class ServerModule {}
