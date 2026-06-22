import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
  }>) {
    return this.prisma.settings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
  }
}
