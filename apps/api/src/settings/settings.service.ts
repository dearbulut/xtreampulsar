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

  async updateSettings(data: Partial<{
    vodDownloadSpeed: number;
    vodDownloadLimit: number;
    bufferSize: number;
    blockVpnProxy: boolean;
    priorityBackupStream: boolean;
    streamDownVideo: string | null;
    bannedVideo: string | null;
    expiredVideo: string | null;
    countryLockVideo: string | null;
    maxConxExceedVideo: string | null;
    enableConxExceedLog: boolean;
    instantCloseConn: boolean;
    adminStreamingIps: string[];
    panelName: string;
    serverUrl: string;
    serverPort: number;
    timezone: string;
    trialUserLimit: number;
    adminEmail: string;
    resellerNotifyExpiry: boolean;
    streamDownAlert: boolean;
    enableLocalBackups: boolean;
    localBackupDir: string;
    autoBackupIntervalHours: number;
    backupsToKeep: number;
    enableRemoteBackup: boolean;
    dropboxApiKey: string;
    discordWebhookUrl?: string | null;
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    discordAlerts?: boolean;
    telegramAlerts?: boolean;
    // Reseller
    registrationOpen?: boolean;
    // Security
    enableGuard?: boolean;
    maxConnsPerIp?: number;
    maxHitsNormal?: number;
    maxHitsRestreamer?: number;
    blockDuration?: number;
    denyInvalidStreamIds?: boolean;
    sensitivePorts?: string[];
    whitelistIPs?: string[];
    openPorts?: string[];
  }>) {
    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
  }
}
