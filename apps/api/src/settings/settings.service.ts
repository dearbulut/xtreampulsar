import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig() {
    const [settings, whiteLabel] = await Promise.all([
      this.prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
        select: { panelName: true },
      }),
      this.prisma.whiteLabel.findFirst({
        where: { isActive: true },
        select: { panelName: true, logoUrl: true, primaryColor: true },
      }),
    ]);

    return {
      panelName: whiteLabel?.panelName ?? settings.panelName,
      logoUrl: whiteLabel?.logoUrl ?? null,
      primaryColor: whiteLabel?.primaryColor ?? null,
    };
  }

  async getSettings() {
    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
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
      'autoEnrichMetadata', 'geoBlockEnabled',
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
