import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig() {
    const [settings, whiteLabel] = await Promise.all([
      this.prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
        select: { panelName: true, currency: true, resellerPanelHost: true, clientPanelHost: true },
      }),
      this.prisma.whiteLabel.findFirst({
        where: { isActive: true },
        select: { panelName: true, logoUrl: true, primaryColor: true },
      }),
    ]);

    return {
      panelName: whiteLabel?.panelName ?? settings.panelName,
      currency: settings.currency ?? 'TRY',
      logoUrl: whiteLabel?.logoUrl ?? null,
      primaryColor: whiteLabel?.primaryColor ?? null,
      resellerHost: settings.resellerPanelHost ?? null,
      clientHost: settings.clientPanelHost ?? null,
    };
  }

  async getSettings() {
    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  async getActiveServerUrl(): Promise<string> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { serverUrl: true, serverUrls: true, primaryUrlIndex: true },
    });
    if (!s) return '';
    const urls = s.serverUrls ?? [];
    if (urls.length > 0) {
      const idx = Math.min(s.primaryUrlIndex ?? 0, urls.length - 1);
      return urls[idx] ?? s.serverUrl ?? '';
    }
    return s.serverUrl ?? '';
  }

  async updateServerUrls(urls: string[]): Promise<void> {
    const cleaned = urls
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));
    await this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: { serverUrls: cleaned, primaryUrlIndex: 0 },
      create: { id: 'singleton', serverUrls: cleaned, primaryUrlIndex: 0 },
    });
  }

  async setPrimaryUrl(index: number): Promise<void> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { serverUrls: true },
    });
    const urls = s?.serverUrls ?? [];
    if (index < 0 || index >= urls.length) return;
    await this.prisma.settings.update({
      where: { id: 'singleton' },
      data: { primaryUrlIndex: index },
    });
  }

  @Cron('*/5 * * * *')
  async checkServerUrlHealth(): Promise<void> {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { serverUrls: true, primaryUrlIndex: true, urlHealthCheck: true },
    });
    if (!s?.urlHealthCheck || !s.serverUrls?.length) return;

    const urls = s.serverUrls;
    const current = s.primaryUrlIndex ?? 0;

    const isAlive = async (url: string): Promise<boolean> => {
      try {
        await axios.get(url, { timeout: 3000, validateStatus: () => true });
        return true;
      } catch {
        return false;
      }
    };

    if (await isAlive(urls[current])) return;

    this.logger.warn(`Primary URL offline: ${urls[current]} — trying fallbacks`);

    for (let i = 0; i < urls.length; i++) {
      if (i === current) continue;
      if (await isAlive(urls[i])) {
        await this.prisma.settings.update({
          where: { id: 'singleton' },
          data: { primaryUrlIndex: i },
        });
        this.logger.log(`Switched primary URL to index ${i}: ${urls[i]}`);
        return;
      }
    }

    this.logger.error('All server URLs are offline, keeping current primary');
  }

  async getCreditPricing() {
    const s = await this.prisma.settings.findUnique({
      where: { id: 'singleton' },
      select: { creditPricing: true },
    });
    return (s?.creditPricing as object | null) ?? {
      durations: [
        { months: 1,  days: 30,  credits: 1,  label: '1 Ay' },
        { months: 3,  days: 90,  credits: 3,  label: '3 Ay' },
        { months: 6,  days: 180, credits: 5,  label: '6 Ay' },
        { months: 9,  days: 270, credits: 7,  label: '9 Ay' },
        { months: 12, days: 365, credits: 10, label: '1 Yıl' },
        { months: 24, days: 730, credits: 18, label: '2 Yıl' },
      ],
      testDurations: [
        { hours: 1,  credits: 0, label: '1 Saat' },
        { hours: 3,  credits: 0, label: '3 Saat' },
        { hours: 6,  credits: 0, label: '6 Saat' },
        { hours: 12, credits: 0, label: '12 Saat' },
        { hours: 24, credits: 0, label: '24 Saat' },
      ],
      customPricing: { enabled: true, creditsPerDay: 0.1 },
    };
  }

  async updateSettings(data: Record<string, unknown>) {
    // Strip undefined, coerce booleans sent as strings or numbers
    const BOOLEAN_FIELDS = new Set([
      'blockVpnProxy', 'priorityBackupStream', 'enableConxExceedLog', 'instantCloseConn',
      'resellerNotifyExpiry', 'streamDownAlert', 'enableLocalBackups', 'enableRemoteBackup',
      'discordAlerts', 'telegramAlerts', 'registrationOpen', 'enableGuard', 'denyInvalidStreamIds',
      'autoEnrichMetadata', 'geoBlockEnabled', 'urlHealthCheck', 'aiEnabled',
    ]);

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (BOOLEAN_FIELDS.has(key)) {
        clean[key] = value === true || value === 'true' || value === 1;
      } else {
        clean[key] = value;
      }
    }

    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: clean,
      create: { id: 'singleton', ...clean },
    });
  }
}
