import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Server } from 'socket.io';
import { AnalyticsService } from '../analytics/analytics.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class EventsGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async broadcastDashboard(): Promise<void> {
    try {
      const data = await this.analyticsService.getDashboard();
      this.server.emit('dashboard:update', data);
    } catch (err) {
      this.logger.error(`broadcastDashboard: ${(err as Error).message}`);
    }
  }

  emitStreamStatus(streamId: string, status: string): void {
    this.server.emit('stream:status', { streamId, status });
  }

  emitConnectionUpdate(connection: unknown): void {
    this.server.emit('connection:new', connection);
  }

  emitConnectionClose(connectionId: string): void {
    this.server.emit('connection:close', { connectionId });
  }
}
