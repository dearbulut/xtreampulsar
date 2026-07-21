import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { MonitorService } from './monitor.service';

/**
 * Sunucu-arasi metrik: bir edge node'un sistem durumunu paylasilan secret ile disa acar.
 * Ana panel `x-node-secret` header'i ile cagirir; secret NODE_SECRET env'ine esit olmali.
 * NODE_SECRET tanimsizsa endpoint kapali (403) — dormant-safe.
 */
@Controller('node')
export class NodeMetricsController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('metrics')
  async metrics(@Headers('x-node-secret') secret?: string) {
    const expected = process.env.NODE_SECRET;
    if (!expected || secret !== expected) throw new ForbiddenException('Invalid node secret');
    return this.monitor.getStatus();
  }
}
