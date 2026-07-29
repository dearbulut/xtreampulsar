import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServerHealthService {
  private static readonly PROBE_PATHS = ['/api/v1/health', '/health'];

  private readonly logger = new Logger(ServerHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async probeAllServers(): Promise<void> {
    const servers = await this.prisma.server.findMany({
      select: { id: true, ip: true, port: true },
    });

    await Promise.allSettled(servers.map((s) => this.probeServer(s)));
  }

  async probeOne(id: string) {
    const server = await this.prisma.server.findUnique({
      where: { id },
      select: { id: true, ip: true, port: true },
    });
    if (!server) return null;
    return this.probeServer(server);
  }

  private async probeServer(server: {
    id: string;
    ip: string;
    port: number;
  }): Promise<{ id: string; isOnline: boolean; responseTime: number | null }> {
    const start = Date.now();
    let isOnline = false;
    let responseTime: number | null = null;

    // Panelin kendi sağlık ucu global `api/v1` önekindedir; 25461 portundaki
    // nginx bloğunda ise sade `/health` proxy'lenir. İkisini de dene.
    // validateStatus: HTTP yanıtı gelmesi sunucunun AYAKTA olduğunu gösterir —
    // eski nginx konfigürasyonunda /health location'ı yok ve 404 dönüyordu;
    // axios bunu fırlatıp sunucuyu sonsuza dek "Offline" gösteriyordu.
    // 5xx gerçek bir arıza sayılır (nginx ayakta, API çökmüş).
    for (const path of ServerHealthService.PROBE_PATHS) {
      try {
        const res = await this.http.axiosRef.get(
          `http://${server.ip}:${server.port}${path}`,
          { timeout: 5000, validateStatus: () => true },
        );
        if (res.status < 500) {
          isOnline = true;
          responseTime = Date.now() - start;
          break;
        }
      } catch {
        // bağlantı reddedildi / zaman aşımı → sonraki yolu dene
      }
    }

    await this.prisma.server.update({
      where: { id: server.id },
      data: { isOnline, lastCheckedAt: new Date(), responseTime },
    });

    this.logger.debug(
      `Server ${server.ip}: ${isOnline ? `online (${responseTime}ms)` : 'offline'}`,
    );

    return { id: server.id, isOnline, responseTime };
  }
}
