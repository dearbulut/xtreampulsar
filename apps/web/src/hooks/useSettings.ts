import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Settings are stored locally until a proper settings API is implemented.
// To integrate with a backend: replace the Zustand store with TanStack Query calls
// to GET /api/v1/settings and PATCH /api/v1/settings.

export interface GeneralSettings {
  panelName: string;
  timezone: string;
  language: string;
  serverUrl: string;
  logoUrl: string;
}

export interface XtreamSettings {
  port: number;
  httpsPort: number;
  outputFormats: string[];
  trialUserLimit: number;
}

export interface ResellerSettings {
  registrationOpen: boolean;
  minCreditWarning: number;
  defaultPackageId: string;
}

export interface StreamingSettings {
  ffmpegPath: string;
  hlsTime: number;
  hlsListSize: number;
  vodSpeedLimit: number;
  bufferSize: number;
  blockVPN: boolean;
  priorityBackup: boolean;
  streamDownUrl: string;
  bannedUserUrl: string;
  expiredUserUrl: string;
}

export interface SecuritySettings {
  enableGuard: boolean;
  sensitivePorts: string[];
  whitelistIPs: string[];
  openPorts: string[];
  maxConnsPerIp: number;
  maxHitsNormal: number;
  maxHitsRestreamer: number;
  blockDuration: number;
  denyInvalidStreamIds: boolean;
}

export interface DatabaseSettings {
  enableLocalBackups: boolean;
  localBackupDir: string;
  autoBackupIntervalHours: number;
  backupsToKeep: number;
  enableRemoteBackup: boolean;
  dropboxApiKey: string;
}

export interface AllSettings {
  general: GeneralSettings;
  xtream: XtreamSettings;
  reseller: ResellerSettings;
  streaming: StreamingSettings;
  security: SecuritySettings;
  database: DatabaseSettings;
}

const DEFAULTS: AllSettings = {
  general: { panelName: 'XtreamPulsar', timezone: 'Europe/Istanbul', language: 'tr', serverUrl: '', logoUrl: '' },
  xtream: { port: 25461, httpsPort: 25463, outputFormats: ['m3u8', 'ts'], trialUserLimit: 0 },
  reseller: { registrationOpen: false, minCreditWarning: 10, defaultPackageId: '' },
  streaming: { ffmpegPath: '/usr/bin/ffmpeg', hlsTime: 2, hlsListSize: 5, vodSpeedLimit: 0, bufferSize: 4096, blockVPN: false, priorityBackup: true, streamDownUrl: '', bannedUserUrl: '', expiredUserUrl: '' },
  security: { enableGuard: false, sensitivePorts: ['22', '3306', '5432'], whitelistIPs: [], openPorts: ['80', '443', '25461'], maxConnsPerIp: 10, maxHitsNormal: 100, maxHitsRestreamer: 50, blockDuration: 60, denyInvalidStreamIds: true },
  database: { enableLocalBackups: false, localBackupDir: '/var/backups/xtreampulsar', autoBackupIntervalHours: 24, backupsToKeep: 7, enableRemoteBackup: false, dropboxApiKey: '' },
};

interface SettingsStore {
  settings: AllSettings;
  update: <K extends keyof AllSettings>(tab: K, values: Partial<AllSettings[K]>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULTS,
      update: (tab, values) =>
        set((s) => ({
          settings: { ...s.settings, [tab]: { ...s.settings[tab], ...values } },
        })),
      reset: () => set({ settings: DEFAULTS }),
    }),
    { name: 'xp-settings' },
  ),
);

export const useSettings = () => useSettingsStore((s) => s.settings);
export const useUpdateSettings = () => useSettingsStore((s) => s.update);
