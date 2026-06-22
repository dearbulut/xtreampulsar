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

  async updateSettings(data: Record<string, unknown>) {
    // Strip undefined, coerce booleans sent as strings or numbers
    const BOOLEAN_FIELDS = new Set([
      'blockVpnProxy', 'priorityBackupStream', 'enableConxExceedLog', 'instantCloseConn',
      'resellerNotifyExpiry', 'streamDownAlert', 'enableLocalBackups', 'enableRemoteBackup',
      'discordAlerts', 'telegramAlerts', 'registrationOpen', 'enableGuard', 'denyInvalidStreamIds',
      'autoEnrichMetadata',
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
