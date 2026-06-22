import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
