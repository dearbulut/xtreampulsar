import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface GeneralSettings {
  panelName: string;
  timezone: string;
  language: string;
  serverUrl: string;
  logoUrl: string;
  adminEmail: string;
  streamDownAlert: boolean;
  resellerNotifyExpiry: boolean;
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  discordAlerts: boolean;
  telegramAlerts: boolean;
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
  vodDownloadSpeed: number;
  vodDownloadLimit: number;
  blockVPN: boolean;
  priorityBackupStream: boolean;
  adminStreamingIps: string[];
  instantCloseConn: boolean;
  enableConxExceedLog: boolean;
  priorityBackup: boolean;
  streamDownUrl: string;
  bannedUserUrl: string;
  expiredUserUrl: string;
  countryLockVideo: string;
  maxConxExceedVideo: string;
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
  general: {
    panelName: 'XtreamPulsar',
    timezone: 'Europe/Istanbul',
    language: 'tr',
    serverUrl: '',
    logoUrl: '',
    adminEmail: '',
    streamDownAlert: true,
    resellerNotifyExpiry: true,
    discordWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
    discordAlerts: false,
    telegramAlerts: false,
  },
  xtream: { port: 25461, httpsPort: 25463, outputFormats: ['m3u8', 'ts'], trialUserLimit: 0 },
  reseller: { registrationOpen: false, minCreditWarning: 10, defaultPackageId: '' },
  streaming: { ffmpegPath: '/usr/bin/ffmpeg', hlsTime: 2, hlsListSize: 5, vodSpeedLimit: 0, bufferSize: 4096, vodDownloadSpeed: 200, vodDownloadLimit: 20, blockVPN: false, priorityBackupStream: false, adminStreamingIps: [], instantCloseConn: false, enableConxExceedLog: false, priorityBackup: true, streamDownUrl: '', bannedUserUrl: '', expiredUserUrl: '', countryLockVideo: '', maxConxExceedVideo: '' },
  security: { enableGuard: false, sensitivePorts: ['22', '3306', '5432'], whitelistIPs: [], openPorts: ['80', '443', '25461'], maxConnsPerIp: 10, maxHitsNormal: 100, maxHitsRestreamer: 50, blockDuration: 60, denyInvalidStreamIds: true },
  database: { enableLocalBackups: false, localBackupDir: '/var/backups/xtreampulsar', autoBackupIntervalHours: 24, backupsToKeep: 7, enableRemoteBackup: false, dropboxApiKey: '' },
};

interface DbSettings {
  panelName: string;
  serverUrl: string;
  serverPort: number;
  timezone: string;
  trialUserLimit: number;
  vodDownloadSpeed: number;
  vodDownloadLimit: number;
  bufferSize: number;
  blockVpnProxy: boolean;
  priorityBackupStream: boolean;
  adminStreamingIps: string[];
  instantCloseConn: boolean;
  enableConxExceedLog: boolean;
  streamDownVideo: string | null;
  bannedVideo: string | null;
  expiredVideo: string | null;
  countryLockVideo: string | null;
  maxConxExceedVideo: string | null;
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
}

function mapDbToStore(db: DbSettings): AllSettings {
  return {
    ...DEFAULTS,
    general: {
      ...DEFAULTS.general,
      panelName: db.panelName,
      serverUrl: db.serverUrl,
      timezone: db.timezone,
      adminEmail: db.adminEmail ?? '',
      streamDownAlert: db.streamDownAlert ?? true,
      resellerNotifyExpiry: db.resellerNotifyExpiry ?? true,
      discordWebhookUrl: db.discordWebhookUrl ?? '',
      telegramBotToken: db.telegramBotToken ?? '',
      telegramChatId: db.telegramChatId ?? '',
      discordAlerts: db.discordAlerts ?? false,
      telegramAlerts: db.telegramAlerts ?? false,
    },
    xtream: {
      ...DEFAULTS.xtream,
      port: db.serverPort,
      trialUserLimit: db.trialUserLimit,
    },
    streaming: {
      ...DEFAULTS.streaming,
      vodDownloadSpeed: db.vodDownloadSpeed,
      vodDownloadLimit: db.vodDownloadLimit,
      bufferSize: db.bufferSize,
      blockVPN: db.blockVpnProxy,
      priorityBackupStream: db.priorityBackupStream,
      adminStreamingIps: db.adminStreamingIps,
      instantCloseConn: db.instantCloseConn,
      enableConxExceedLog: db.enableConxExceedLog,
      streamDownUrl: db.streamDownVideo ?? '',
      bannedUserUrl: db.bannedVideo ?? '',
      expiredUserUrl: db.expiredVideo ?? '',
      countryLockVideo: db.countryLockVideo ?? '',
      maxConxExceedVideo: db.maxConxExceedVideo ?? '',
    },
    database: {
      ...DEFAULTS.database,
      enableLocalBackups: db.enableLocalBackups ?? false,
      localBackupDir: db.localBackupDir ?? '/opt/xtreampulsar/backups',
      autoBackupIntervalHours: db.autoBackupIntervalHours ?? 6,
      backupsToKeep: db.backupsToKeep ?? 5,
      enableRemoteBackup: db.enableRemoteBackup ?? false,
      dropboxApiKey: db.dropboxApiKey ?? '',
    },
  };
}

function mapStoreToDB(settings: AllSettings): Partial<DbSettings> {
  return {
    panelName: settings.general.panelName,
    serverUrl: settings.general.serverUrl,
    timezone: settings.general.timezone,
    adminEmail: settings.general.adminEmail,
    streamDownAlert: settings.general.streamDownAlert,
    resellerNotifyExpiry: settings.general.resellerNotifyExpiry,
    discordWebhookUrl: settings.general.discordWebhookUrl || null,
    telegramBotToken: settings.general.telegramBotToken || null,
    telegramChatId: settings.general.telegramChatId || null,
    discordAlerts: settings.general.discordAlerts,
    telegramAlerts: settings.general.telegramAlerts,
    serverPort: settings.xtream.port,
    trialUserLimit: settings.xtream.trialUserLimit,
    vodDownloadSpeed: settings.streaming.vodDownloadSpeed,
    vodDownloadLimit: settings.streaming.vodDownloadLimit,
    bufferSize: settings.streaming.bufferSize,
    blockVpnProxy: settings.streaming.blockVPN,
    priorityBackupStream: settings.streaming.priorityBackupStream,
    adminStreamingIps: settings.streaming.adminStreamingIps,
    instantCloseConn: settings.streaming.instantCloseConn,
    enableConxExceedLog: settings.streaming.enableConxExceedLog,
    streamDownVideo: settings.streaming.streamDownUrl || null,
    bannedVideo: settings.streaming.bannedUserUrl || null,
    expiredVideo: settings.streaming.expiredUserUrl || null,
    countryLockVideo: settings.streaming.countryLockVideo || null,
    maxConxExceedVideo: settings.streaming.maxConxExceedVideo || null,
    enableLocalBackups: settings.database.enableLocalBackups,
    localBackupDir: settings.database.localBackupDir,
    autoBackupIntervalHours: settings.database.autoBackupIntervalHours,
    backupsToKeep: settings.database.backupsToKeep,
    enableRemoteBackup: settings.database.enableRemoteBackup,
    dropboxApiKey: settings.database.dropboxApiKey,
  };
}

interface SettingsStore {
  settings: AllSettings;
  update: <K extends keyof AllSettings>(tab: K, values: Partial<AllSettings[K]>) => void;
  setAll: (settings: AllSettings) => void;
  reset: () => void;
}

const useSettingsStore = create<SettingsStore>()((set) => ({
  settings: DEFAULTS,
  update: (tab, values) =>
    set((s) => ({
      settings: { ...s.settings, [tab]: { ...s.settings[tab], ...values } },
    })),
  setAll: (settings) => set({ settings }),
  reset: () => set({ settings: DEFAULTS }),
}));

export const useSettings = () => useSettingsStore((s) => s.settings);
export const useUpdateSettings = () => useSettingsStore((s) => s.update);

// Call at the top of SettingsPage to populate store from API
export function useSyncSettings() {
  const setAll = useSettingsStore((s) => s.setAll);

  useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DbSettings }>('/settings');
      setAll(mapDbToStore(res.data.data));
      return res.data.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AllSettings) =>
      api.patch('/settings', mapStoreToDB(settings)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Ayarlar kaydedildi');
    },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}
