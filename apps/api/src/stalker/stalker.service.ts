import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StalkerService {
  private readonly logger = new Logger(StalkerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handshake(mac: string, serialNumber?: string) {
    const token = crypto.randomBytes(16).toString('hex');

    const device = await this.prisma.magDevice.upsert({
      where: { mac },
      update: { token, lastSeen: new Date(), serialNumber: serialNumber ?? undefined },
      create: { mac, token, serialNumber: serialNumber ?? undefined },
      include: { user: { select: { id: true, username: true, status: true, expiresAt: true } } },
    });

    this.logger.log(`MAG handshake: ${mac} → token ${token.slice(0, 8)}…`);
    return { token, deviceId: device.id, userId: device.userId };
  }

  async getProfile(mac: string) {
    const device = await this.prisma.magDevice.findUnique({
      where: { mac },
      include: { user: { select: { id: true, username: true, status: true, expiresAt: true, maxConnections: true } } },
    });

    const user = device?.user;
    return {
      id: device?.id ?? '0',
      name: user?.username ?? 'guest',
      sex: 'male',
      status: user?.status ?? 'ACTIVE',
      exp_date: user?.expiresAt ? Math.floor(user.expiresAt.getTime() / 1000).toString() : '0',
      max_connections: user?.maxConnections?.toString() ?? '1',
    };
  }

  async getMainInfo() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const totalChannels = await this.prisma.stream.count({ where: { isActive: true } });

    return {
      EPGUrl: '',
      serverName: settings?.panelName ?? 'XtreamPulsar',
      totalChannels,
      timezone: settings?.timezone ?? 'UTC',
    };
  }

  async getAllChannels(mac: string, page = 1, itemsPerPage = 14) {
    const device = await this.prisma.magDevice.findUnique({
      where: { mac },
      include: { user: true },
    });

    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const baseUrl = settings?.serverUrl
      ? `${settings.serverUrl}:${settings.serverPort ?? 25461}`
      : `http://localhost:${settings?.serverPort ?? 25461}`;

    const username = device?.user?.username ?? 'guest';
    const password = '****';

    const [streams, total] = await Promise.all([
      this.prisma.stream.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * itemsPerPage,
        take: itemsPerPage,
      }),
      this.prisma.stream.count({ where: { isActive: true } }),
    ]);

    const data = streams.map((s, i) => ({
      id: s.externalId,
      name: s.name,
      number: (page - 1) * itemsPerPage + i + 1,
      cmd: `ffmpeg ${baseUrl}/live/${username}/${password}/${s.externalId}.m3u8`,
      logo: s.tvgLogo ?? '',
      tv_genre_id: s.category.externalId,
      censored: 0,
      use_http_tmp_link: 0,
    }));

    return {
      total_items: total,
      max_page_items: itemsPerPage,
      selected_item: 0,
      data,
    };
  }

  async getGenres() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { externalId: true, name: true },
    });

    return categories.map((c) => ({
      id: c.externalId,
      title: c.name,
      censored: 0,
      alias: c.name.toLowerCase().replace(/\s+/g, '_'),
    }));
  }

  async createLink(mac: string, streamId: number) {
    const settings = await this.prisma.settings.findUnique({ where: { id: 'singleton' } });
    const device = await this.prisma.magDevice.findUnique({
      where: { mac },
      include: { user: true },
    });
    const baseUrl = settings?.serverUrl
      ? `${settings.serverUrl}:${settings.serverPort ?? 25461}`
      : `http://localhost:${settings?.serverPort ?? 25461}`;

    const username = device?.user?.username ?? 'guest';
    return `${baseUrl}/live/${username}/****/${streamId}.m3u8`;
  }
}
