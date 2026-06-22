import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServerGuardService {
  constructor(private readonly prisma: PrismaService) {}

  getGuard(serverId: string) {
    return this.prisma.serverGuard.upsert({
      where: { serverId },
      update: {},
      create: { serverId },
    });
  }

  updateGuard(
    serverId: string,
    data: Partial<{
      enabled: boolean;
      sensitivePorts: number[];
      whitelistIps: string[];
      openPorts: number[];
      maxConnsPerIp: number;
      maxHitsNormalUser: number;
      maxHitsRestreamer: number;
      whitelistUsernames: string[];
      blockDurationMinutes: number;
      denyInvalidStreamIds: boolean;
      blockVpnProxy: boolean;
    }>,
  ) {
    return this.prisma.serverGuard.upsert({
      where: { serverId },
      update: data,
      create: { serverId, ...data },
    });
  }

  getBlockedIps(serverId: string) {
    return this.prisma.blockedIp.findMany({
      where: { serverId },
      orderBy: { blockedAt: 'desc' },
    });
  }

  async unblockIp(serverId: string, ip: string) {
    const count = await this.prisma.blockedIp.deleteMany({
      where: { serverId, ip },
    });
    return { unblocked: count.count };
  }

  async getGuardStats(serverId: string) {
    const now = new Date();
    const [totalBlocked, activeBlocked, expiredBlocked] = await Promise.all([
      this.prisma.blockedIp.count({ where: { serverId } }),
      this.prisma.blockedIp.count({ where: { serverId, expiresAt: { gt: now } } }),
      this.prisma.blockedIp.count({ where: { serverId, expiresAt: { lte: now } } }),
    ]);
    return { totalBlocked, activeBlocked, expiredBlocked };
  }
}
