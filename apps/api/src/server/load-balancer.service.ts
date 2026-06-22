import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

const CONN_TTL = 35;

@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getOptimalServer(): Promise<{ serverId: string; serverUrl: string; serverIp: string } | null> {
    const servers = await this.prisma.server.findMany({
      where: { role: 'LOAD_BALANCER' },
    });

    if (servers.length === 0) return null;

    const loads = await Promise.all(
      servers.map(async (srv) => {
        const raw = await this.redis.get(`server:${srv.id}:connections`);
        const connections = parseInt(raw ?? '0', 10);
        const utilization = srv.maxClients > 0 ? connections / srv.maxClients : 1;
        return { srv, connections, utilization };
      }),
    );

    // weighted selection: prefer lowest utilization
    const best = loads.reduce((prev, cur) =>
      cur.utilization < prev.utilization ? cur : prev,
    );

    const protocol = 'http';
    const port = best.srv.port ?? 25461;
    return {
      serverId: best.srv.id,
      serverUrl: `${protocol}://${best.srv.ip}:${port}`,
      serverIp: best.srv.ip,
    };
  }

  async registerConnection(serverId: string): Promise<void> {
    const key = `server:${serverId}:connections`;
    await this.redis.incr(key);
    await this.redis.expire(key, CONN_TTL);
  }

  async releaseConnection(serverId: string): Promise<void> {
    const key = `server:${serverId}:connections`;
    const val = await this.redis.get(key);
    if (val && parseInt(val, 10) > 0) {
      await this.redis.decr(key);
    }
  }

  async heartbeat(serverId: string): Promise<void> {
    const key = `server:${serverId}:connections`;
    const exists = await this.redis.exists(key);
    if (exists) await this.redis.expire(key, CONN_TTL);
  }

  async getLoadStats(): Promise<
    Array<{ serverId: string; name: string; ip: string; connections: number; maxClients: number; utilization: number; isOnline: boolean }>
  > {
    const servers = await this.prisma.server.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      servers.map(async (srv) => {
        const raw = await this.redis.get(`server:${srv.id}:connections`);
        const connections = parseInt(raw ?? '0', 10);
        const utilization =
          srv.maxClients > 0 ? Math.round((connections / srv.maxClients) * 100) : 0;
        return {
          serverId: srv.id,
          name: srv.name,
          ip: srv.ip,
          connections,
          maxClients: srv.maxClients,
          utilization,
          isOnline: srv.isOnline ?? false,
        };
      }),
    );
  }
}
