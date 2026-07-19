import { useQuery, useMutation } from '@tanstack/react-query';
import { create } from 'zustand';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface GeneralSettings {
  panelName: string;
  timezone: string;
  language: string;
  serverUrl: string;
  serverUrls: string[];
  primaryUrlIndex: number;
  urlHealthCheck: boolean;
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
  trialDays: number;
  trialMaxConnections: number;
}

export interface CreditPricingDuration {
  months: number;
  days: number;
  credits: number;
  label: string;
}

export interface CreditPricingTestDuration {
  hours: number;
  credits: number;
  label: string;
}

export interface CreditPricingConfig {
  durations: CreditPricingDuration[];
  testDurations: CreditPricingTestDuration[];
  customPricing: { enabled: boolean; creditsPerDay: number };
}

export const DEFAULT_CREDIT_PRICING: CreditPricingConfig = {
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

export interface ResellerSettings {
  registrationOpen: boolean;
  minCreditWarning: number;
  defaultPackageId: string;
  tierPricing: Record<string, number>;
  creditPricing: CreditPricingConfig;
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
  geoBlockEnabled: boolean;
  allowedCountries: string[];
}

export interface DatabaseSettings {
  enableLocalBackups: boolean;
  localBackupDir: string;
  autoBackupIntervalHours: number;
  backupsToKeep: number;
  enableRemoteBackup: boolean;
  dropboxApiKey: string;
  backupEncryptionKey: string;
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
    serverUrls: [],
    primaryUrlIndex: 0,
    urlHealthCheck: true,
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
  xtream: { port: 25461, httpsPort: 25463, outputFormats: ['m3u8', 'ts'], trialUserLimit: 0, trialDays: 7, trialMaxConnections: 1 },
  reseller: { registrationOpen: false, minCreditWarning: 10, defaultPackageId: '', tierPricing: { BASIC: 1, SILVER: 1, GOLD: 1, PLATINUM: 1 }, creditPricing: DEFAULT_CREDIT_PRICING },
  streaming: { ffmpegPath: '/usr/bin/ffmpeg', hlsTime: 2, hlsListSize: 5, vodSpeedLimit: 0, bufferSize: 4096, vodDownloadSpeed: 200, vodDownloadLimit: 20, blockVPN: false, priorityBackupStream: false, adminStreamingIps: [], instantCloseConn: false, enableConxExceedLog: false, priorityBackup: true, streamDownUrl: '', bannedUserUrl: '', expiredUserUrl: '', countryLockVideo: '', maxConxExceedVideo: '' },
  security: { enableGuard: false, sensitivePorts: ['22', '3306', '5432'], whitelistIPs: [], openPorts: ['80', '443', '25461'], maxConnsPerIp: 10, maxHitsNormal: 100, maxHitsRestreamer: 50, blockDuration: 60, denyInvalidStreamIds: true, geoBlockEnabled: false, allowedCountries: [] },
  database: { enableLocalBackups: false, localBackupDir: '/var/backups/xtreampulsar', autoBackupIntervalHours: 24, backupsToKeep: 7, enableRemoteBackup: false, dropboxApiKey: '', backupEncryptionKey: '' },
};

interface DbSettings {
  panelName: string;
  serverUrl: string;
  serverUrls?: string[];
  primaryUrlIndex?: number;
  urlHealthCheck?: boolean;
  serverPort: number;
  timezone: string;
  trialUserLimit: number;
  trialDays?: number;
  trialMaxConnections?: number;
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
  backupEncryptionKey?: string | null;
  discordWebhookUrl?: string | null;
  telegramBotToken?: string | null;
  telegramChatId?: string | null;
  discordAlerts?: boolean;
  telegramAlerts?: boolean;
  // Reseller
  registrationOpen?: boolean;
  tierPricing?: Record<string, number>;
  creditPricing?: CreditPricingConfig | null;
  // Security
  geoBlockEnabled?: boolean;
  allowedCountries?: string[];
  enableGuard?: boolean;
  maxConnsPerIp?: number;
  maxHitsNormal?: number;
  maxHitsRestreamer?: number;
  blockDuration?: number;
  denyInvalidStreamIds?: boolean;
  sensitivePorts?: string[];
  whitelistIPs?: string[];
  openPorts?: string[];
}

function mapDbToStore(db: DbSettings): AllSettings {
  return {
    ...DEFAULTS,
    general: {
      ...DEFAULTS.general,
      panelName: db.panelName,
      serverUrl: db.serverUrl,
      serverUrls: db.serverUrls ?? [],
      primaryUrlIndex: db.primaryUrlIndex ?? 0,
      urlHealthCheck: db.urlHealthCheck ?? true,
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
      trialDays: db.trialDays ?? 7,
      trialMaxConnections: db.trialMaxConnections ?? 1,
    },
    reseller: {
      ...DEFAULTS.reseller,
      registrationOpen: db.registrationOpen ?? false,
      tierPricing: db.tierPricing ?? { BASIC: 1, SILVER: 1, GOLD: 1, PLATINUM: 1 },
      creditPricing: db.creditPricing ?? DEFAULT_CREDIT_PRICING,
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
    security: {
      ...DEFAULTS.security,
      enableGuard: db.enableGuard ?? false,
      maxConnsPerIp: db.maxConnsPerIp ?? 10,
      maxHitsNormal: db.maxHitsNormal ?? 100,
      maxHitsRestreamer: db.maxHitsRestreamer ?? 50,
      blockDuration: db.blockDuration ?? 60,
      denyInvalidStreamIds: db.denyInvalidStreamIds ?? true,
      sensitivePorts: db.sensitivePorts ?? ['22', '3306', '5432'],
      whitelistIPs: db.whitelistIPs ?? [],
      openPorts: db.openPorts ?? ['80', '443', '25461'],
      geoBlockEnabled: db.geoBlockEnabled ?? false,
      allowedCountries: db.allowedCountries ?? [],
    },
    database: {
      ...DEFAULTS.database,
      enableLocalBackups: db.enableLocalBackups ?? false,
      localBackupDir: db.localBackupDir ?? '/opt/xtreampulsar/backups',
      autoBackupIntervalHours: db.autoBackupIntervalHours ?? 6,
      backupsToKeep: db.backupsToKeep ?? 5,
      enableRemoteBackup: db.enableRemoteBackup ?? false,
      dropboxApiKey: db.dropboxApiKey ?? '',
      backupEncryptionKey: db.backupEncryptionKey ?? '',
    },
  };
}

function mapStoreToDB(settings: AllSettings): Partial<DbSettings> {
  return {
    // General
    panelName: settings.general.panelName,
    serverUrl: settings.general.serverUrl,
    serverUrls: settings.general.serverUrls,
    primaryUrlIndex: settings.general.primaryUrlIndex,
    urlHealthCheck: settings.general.urlHealthCheck,
    timezone: settings.general.timezone,
    adminEmail: settings.general.adminEmail,
    streamDownAlert: settings.general.streamDownAlert,
    resellerNotifyExpiry: settings.general.resellerNotifyExpiry,
    discordWebhookUrl: settings.general.discordWebhookUrl || null,
    telegramBotToken: settings.general.telegramBotToken || null,
    telegramChatId: settings.general.telegramChatId || null,
    discordAlerts: settings.general.discordAlerts,
    telegramAlerts: settings.general.telegramAlerts,
    // Xtream
    serverPort: settings.xtream.port,
    trialUserLimit: settings.xtream.trialUserLimit,
    trialDays: settings.xtream.trialDays,
    trialMaxConnections: settings.xtream.trialMaxConnections,
    // Reseller
    registrationOpen: settings.reseller.registrationOpen,
    tierPricing: settings.reseller.tierPricing,
    creditPricing: settings.reseller.creditPricing,
    // Streaming
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
    // Security
    enableGuard: settings.security.enableGuard,
    maxConnsPerIp: settings.security.maxConnsPerIp,
    maxHitsNormal: settings.security.maxHitsNormal,
    maxHitsRestreamer: settings.security.maxHitsRestreamer,
    blockDuration: settings.security.blockDuration,
    denyInvalidStreamIds: settings.security.denyInvalidStreamIds,
    sensitivePorts: settings.security.sensitivePorts,
    whitelistIPs: settings.security.whitelistIPs,
    openPorts: settings.security.openPorts,
    geoBlockEnabled: settings.security.geoBlockEnabled,
    allowedCountries: settings.security.allowedCountries,
    // Database / Backup
    enableLocalBackups: settings.database.enableLocalBackups,
    localBackupDir: settings.database.localBackupDir,
    autoBackupIntervalHours: settings.database.autoBackupIntervalHours,
    backupsToKeep: settings.database.backupsToKeep,
    enableRemoteBackup: settings.database.enableRemoteBackup,
    dropboxApiKey: settings.database.dropboxApiKey,
    backupEncryptionKey: settings.database.backupEncryptionKey || null,
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
  return useMutation({
    mutationFn: (settings: AllSettings) =>
      api.patch('/settings', mapStoreToDB(settings)),
    onSuccess: () => {
      // Don't invalidate/refetch — the Zustand store already holds the saved state.
      // A refetch would race against the DB write and could overwrite local values.
      toast.success('Ayarlar kaydedildi');
    },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}
