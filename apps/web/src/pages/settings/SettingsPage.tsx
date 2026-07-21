import { useState, useRef, useEffect } from 'react';
import { copyToClipboard } from '@/lib/utils';
import { Save, RotateCcw, Globe, Tv, Users, Radio, Shield, Database, HardDrive, Trash2, Upload, Download, Bell, Key, Copy, Check, Palette, Image as ImageIcon, Plus, Star, AlertCircle, Sparkles, Link2 } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { TagInput } from '@/components/ui/TagInput';
import { useSettings, useUpdateSettings, useSyncSettings, useSaveSettings } from '@/hooks/useSettings';
import type { CreditPricingConfig } from '@/hooks/useSettings';
import { DEFAULT_CREDIT_PRICING } from '@/hooks/useSettings';
import { CURRENCIES } from '@/lib/currency';
import { useBackupList, useCreateBackup, useDeleteBackup, useUploadDropbox, useDownloadBackup, formatBytes } from '@/hooks/useBackup';
import { useQueryClient } from '@tanstack/react-query';
import { use2FAStatus, use2FASetup, use2FAEnable, use2FADisable } from '@/hooks/useTwoFactor';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useWhiteLabel, useUpdateWhiteLabel, useUploadLogo } from '@/hooks/useWhiteLabel';
import { useAiSettings, useSaveAiSettings, type AiSettings } from '@/hooks/useAiSettings';
import { usePanelHosts, useSavePanelHosts, type PanelHosts } from '@/hooks/usePanelHosts';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const getSettingsTabs = (t: (key: string) => string): TabItem[] => [
  { id: 'general', label: t('settings.tabGeneral'), icon: Globe },
  { id: 'xtream', label: 'Xtream', icon: Tv },
  { id: 'reseller', label: 'Reseller', icon: Users },
  { id: 'streaming', label: 'Streaming', icon: Radio },
  { id: 'security', label: t('nav.security'), icon: Shield },
  { id: 'database', label: t('settings.tabDatabase'), icon: Database },
  { id: 'api', label: 'API', icon: Key },
  { id: 'white-label', label: 'White-Label', icon: Palette },
  { id: 'ai', label: t('settings.tabAi'), icon: Sparkles },
  { id: 'panel-hosts', label: t('settings.tabPanelHosts'), icon: Link2 },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-2 mb-4">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
      <div>
        <div className="text-sm font-medium text-slate-300">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function TwoFactorSection() {
  const { t } = useTranslation();
  const [showSetup, setShowSetup] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const queryClient = useQueryClient();
  const status = use2FAStatus();
  const enabled = status.data?.twoFactorEnabled ?? false;

  // Never generate a setup secret while 2FA is already enabled — guarded on the
  // real server state so an active secret can't be clobbered.
  const setup = use2FASetup(showSetup && !enabled);
  const enableMut = use2FAEnable();
  const disableMut = use2FADisable();

  const handleEnable = async () => {
    await enableMut.mutateAsync(code);
    setShowSetup(false);
    setCode('');
    await queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
  };

  const handleDisable = async () => {
    await disableMut.mutateAsync(password);
    setPassword('');
    await queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
  };

  return (
    <div className="mt-2">
      <SectionTitle>{t('settings.twoFactorTitle')}</SectionTitle>
      <div className="space-y-4">
        {status.isLoading ? (
          <p className="text-muted text-sm">{t('settings.statusLoading')}</p>
        ) : !enabled ? (
          <>
            {!showSetup ? (
              <button className="btn-secondary text-sm" onClick={() => setShowSetup(true)}>
                {t('settings.start2faSetup')}
              </button>
            ) : (
              <div className="space-y-4 p-4 rounded-xl bg-surface border border-border">
                {setup.isLoading && <p className="text-muted text-sm">{t('settings.qrLoading')}</p>}
                {setup.data && (
                  <>
                    <p className="text-sm text-slate-300">{t('settings.scanQr')}</p>
                    <img src={setup.data.qrCodeImage} alt="2FA QR" className="w-44 h-44 rounded-lg" />
                    <p className="text-xs text-muted font-mono break-all">{setup.data.secret}</p>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder={t('settings.sixDigitCode')}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                      />
                      <button
                        className="btn-primary text-sm px-4"
                        disabled={enableMut.isPending || code.length !== 6}
                        onClick={() => void handleEnable()}
                      >
                        {t('common.confirm')}
                      </button>
                    </div>
                  </>
                )}
                <button className="text-sm text-muted hover:text-slate-300" onClick={() => setShowSetup(false)}>{t('common.cancel')}</button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-surface border border-border">
            <p className="text-sm text-green-400">{t('settings.twoFaEnabled')}</p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="password"
                placeholder={t('settings.enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="btn-danger text-sm px-4"
                disabled={disableMut.isPending}
                onClick={() => void handleDisable()}
              >
                {t('settings.disable2fa')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');
  const [deleteBackupFile, setDeleteBackupFile] = useState<string | null>(null);
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  useSyncSettings();
  const saveSettings = useSaveSettings();

  const { data: backupList = [], isLoading: backupsLoading } = useBackupList();
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const uploadDropbox = useUploadDropbox();
  const downloadBackup = useDownloadBackup();

  const save = () => saveSettings.mutate(settings);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('settings.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => toast(t('settings.resetToDefaults'), { icon: '↺' })}>
            <RotateCcw className="w-4 h-4" /> {t('settings.reset')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saveSettings.isPending}>
            <Save className="w-4 h-4" /> {saveSettings.isPending ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <Tabs tabs={getSettingsTabs(t)} active={activeTab} onChange={setActiveTab} />

      <div className="card p-6 space-y-6">

        {/* === GENERAL === */}
        {activeTab === 'general' && (
          <>
            <SectionTitle>{t('settings.panelSettings')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.panelName')} hint={t('settings.panelNameHint')}>
                <input className="input" value={settings.general.panelName}
                  onChange={(e) => updateSettings('general', { panelName: e.target.value })} />
              </Field>
              <Field label={t('settings.timezone')}>
                <select className="input" value={settings.general.timezone}
                  onChange={(e) => updateSettings('general', { timezone: e.target.value })}>
                  {['Europe/Istanbul', 'UTC', 'Europe/London', 'America/New_York'].map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('settings.currency')} hint={t('settings.currencyHint')}>
                <select className="input" value={settings.general.currency}
                  onChange={(e) => updateSettings('general', { currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.symbol} · {c.code} — {c.label}</option>
                  ))}
                </select>
              </Field>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-slate-200">{t('settings.serverUrlList')}</span>
                    <p className="text-xs text-muted mt-0.5">{t('settings.serverUrlListHint')}</p>
                  </div>
                  <button
                    type="button"
                    disabled={(settings.general.serverUrls ?? []).length >= 5}
                    onClick={() => updateSettings('general', { serverUrls: [...(settings.general.serverUrls ?? []), ''] })}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('settings.addUrl')}
                  </button>
                </div>
                {(settings.general.serverUrls ?? []).length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {t('settings.noUrlWarning')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(settings.general.serverUrls ?? []).map((url, idx) => {
                      const isPrimary = idx === (settings.general.primaryUrlIndex ?? 0);
                      return (
                        <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${isPrimary ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-surface-2/30'}`}>
                          <button
                            type="button"
                            title={t('settings.makePrimary')}
                            onClick={() => updateSettings('general', { primaryUrlIndex: idx })}
                            className={`shrink-0 transition-colors ${isPrimary ? 'text-emerald-400' : 'text-muted hover:text-slate-300'}`}
                          >
                            <Star className={`w-4 h-4 ${isPrimary ? 'fill-emerald-400' : ''}`} />
                          </button>
                          <input
                            className="input flex-1 py-1.5 text-sm"
                            value={url}
                            placeholder="http://panel.example.com"
                            onChange={(e) => {
                              const next = [...(settings.general.serverUrls ?? [])];
                              next[idx] = e.target.value;
                              updateSettings('general', { serverUrls: next });
                            }}
                          />
                          {isPrimary && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">{t('common.active')}</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const next = (settings.general.serverUrls ?? []).filter((_, i) => i !== idx);
                              const newPrimary = idx === (settings.general.primaryUrlIndex ?? 0) ? 0 : Math.min(settings.general.primaryUrlIndex ?? 0, next.length - 1);
                              updateSettings('general', { serverUrls: next, primaryUrlIndex: Math.max(0, newPrimary) });
                            }}
                            className="shrink-0 text-muted hover:text-danger transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Field label={t('settings.autoSwitch')} hint={t('settings.autoSwitchHint')}>
                  <Toggle checked={settings.general.urlHealthCheck ?? true}
                    onChange={(v) => updateSettings('general', { urlHealthCheck: v })} />
                </Field>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {t('settings.urlChangeInfo')}
                </div>
              </div>
              <Field label={t('settings.logoUrl')}>
                <input className="input" value={settings.general.logoUrl}
                  onChange={(e) => updateSettings('general', { logoUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
            </div>
            <SectionTitle>{t('settings.notifications')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.adminEmail')} hint={t('settings.adminEmailHint')}>
                <input className="input" type="email" value={settings.general.adminEmail}
                  onChange={(e) => updateSettings('general', { adminEmail: e.target.value })}
                  placeholder="admin@example.com" />
              </Field>
              <Field label={t('settings.streamDownAlert')} hint={t('settings.streamDownAlertHint')}>
                <Toggle checked={settings.general.streamDownAlert}
                  onChange={(v) => updateSettings('general', { streamDownAlert: v })} />
              </Field>
              <Field label={t('settings.resellerExpiryNotify')} hint={t('settings.resellerExpiryNotifyHint')}>
                <Toggle checked={settings.general.resellerNotifyExpiry}
                  onChange={(v) => updateSettings('general', { resellerNotifyExpiry: v })} />
              </Field>
            </div>
            <SectionTitle>{t('settings.discordNotifications')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.discordWebhookUrl')}>
                <input className="input" value={settings.general.discordWebhookUrl}
                  onChange={(e) => updateSettings('general', { discordWebhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..." />
              </Field>
              <Field label={t('settings.discordAlertsActive')}>
                <Toggle checked={settings.general.discordAlerts}
                  onChange={(v) => updateSettings('general', { discordAlerts: v })} />
              </Field>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => api.post('/notifications/test-discord').then(() => toast.success(t('settings.discordTestSuccess'))).catch(() => toast.error(t('settings.discordTestFail')))}
              >
                {t('settings.discordTestSend')}
              </button>
            </div>
            <SectionTitle>{t('settings.telegramNotifications')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.telegramBotToken')}>
                <input className="input" value={settings.general.telegramBotToken}
                  onChange={(e) => updateSettings('general', { telegramBotToken: e.target.value })}
                  placeholder="123456789:ABC..." />
              </Field>
              <Field label={t('settings.telegramChatId')}>
                <input className="input" value={settings.general.telegramChatId}
                  onChange={(e) => updateSettings('general', { telegramChatId: e.target.value })}
                  placeholder="-1001234567890" />
              </Field>
              <Field label={t('settings.telegramAlertsActive')}>
                <Toggle checked={settings.general.telegramAlerts}
                  onChange={(v) => updateSettings('general', { telegramAlerts: v })} />
              </Field>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => api.post('/notifications/test-telegram').then(() => toast.success(t('settings.telegramTestSuccess'))).catch(() => toast.error(t('settings.telegramTestFail')))}
              >
                {t('settings.telegramTestSend')}
              </button>
            </div>
          </>
        )}

        {/* === XTREAM === */}
        {activeTab === 'xtream' && (
          <>
            <SectionTitle>{t('settings.xtreamCodesApi')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.httpPort')}>
                <input type="number" className="input" value={settings.xtream.port}
                  onChange={(e) => updateSettings('xtream', { port: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.httpsPort')}>
                <input type="number" className="input" value={settings.xtream.httpsPort}
                  onChange={(e) => updateSettings('xtream', { httpsPort: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.outputFormats')} hint={t('settings.outputFormatsHint')}>
                <TagInput
                  value={settings.xtream.outputFormats}
                  onChange={(v) => updateSettings('xtream', { outputFormats: v })}
                  placeholder="m3u8, ts, rtmp…"
                />
              </Field>
              <Field label={t('settings.trialUserLimit')} hint={t('settings.trialUserLimitHint')}>
                <input type="number" className="input" value={settings.xtream.trialUserLimit}
                  onChange={(e) => updateSettings('xtream', { trialUserLimit: parseInt(e.target.value, 10) })} />
              </Field>
            </div>

            <SectionTitle>{t('settings.trialSettings')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.defaultTrialDuration')} hint={t('settings.defaultTrialDurationHint')}>
                <input type="number" min={1} max={90} className="input" value={settings.xtream.trialDays}
                  onChange={(e) => updateSettings('xtream', { trialDays: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.defaultMaxConn')} hint={t('settings.defaultMaxConnHint')}>
                <input type="number" min={1} max={5} className="input" value={settings.xtream.trialMaxConnections}
                  onChange={(e) => updateSettings('xtream', { trialMaxConnections: parseInt(e.target.value, 10) })} />
              </Field>
            </div>
          </>
        )}

        {/* === RESELLER === */}
        {activeTab === 'reseller' && (
          <ResellerTab settings={settings} updateSettings={updateSettings} />
        )}

        {/* === STREAMING === */}
        {activeTab === 'streaming' && (
          <>
            <SectionTitle>{t('settings.ffmpegHls')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.ffmpegPath')}>
                <input className="input font-mono" value={settings.streaming.ffmpegPath}
                  onChange={(e) => updateSettings('streaming', { ffmpegPath: e.target.value })} />
              </Field>
              <Field label={t('settings.hlsSegmentDuration')}>
                <input type="number" className="input" value={settings.streaming.hlsTime}
                  onChange={(e) => updateSettings('streaming', { hlsTime: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.hlsListSize')}>
                <input type="number" className="input" value={settings.streaming.hlsListSize}
                  onChange={(e) => updateSettings('streaming', { hlsListSize: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.bufferSize')}>
                <input type="number" className="input" value={settings.streaming.bufferSize}
                  onChange={(e) => updateSettings('streaming', { bufferSize: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.vodDownloadSpeed')}>
                <input type="number" className="input" value={settings.streaming.vodDownloadSpeed}
                  onChange={(e) => updateSettings('streaming', { vodDownloadSpeed: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.vodDownloadLimit')}>
                <input type="number" className="input" value={settings.streaming.vodDownloadLimit}
                  onChange={(e) => updateSettings('streaming', { vodDownloadLimit: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.blockVpn')}>
                <Toggle checked={settings.streaming.blockVPN}
                  onChange={(v) => updateSettings('streaming', { blockVPN: v })} />
              </Field>
              <Field label={t('settings.priorityBackupStream')}>
                <Toggle checked={settings.streaming.priorityBackupStream}
                  onChange={(v) => updateSettings('streaming', { priorityBackupStream: v })} />
              </Field>
              <Field label={t('settings.adminStreamingIps')}>
                <TagInput value={settings.streaming.adminStreamingIps}
                  onChange={(v) => updateSettings('streaming', { adminStreamingIps: v })}
                  placeholder="192.168.1.1..." />
              </Field>
              <Field label={t('settings.instantCloseConn')}>
                <Toggle checked={settings.streaming.instantCloseConn}
                  onChange={(v) => updateSettings('streaming', { instantCloseConn: v })} />
              </Field>
              <Field label={t('settings.connExceedLog')}>
                <Toggle checked={settings.streaming.enableConxExceedLog}
                  onChange={(v) => updateSettings('streaming', { enableConxExceedLog: v })} />
              </Field>
              <SectionTitle>{t('settings.idleSleepTitle')}</SectionTitle>
              <Field label={t('settings.idleSleepEnabled')} hint={t('settings.idleSleepHint')}>
                <Toggle checked={settings.streaming.idleSleepEnabled}
                  onChange={(v) => updateSettings('streaming', { idleSleepEnabled: v })} />
              </Field>
              <Field label={t('settings.idleSleepMins')} hint={t('settings.idleSleepMinsHint')}>
                <input type="number" min={1} max={240} className="input w-32"
                  value={settings.streaming.idleSleepMins}
                  disabled={!settings.streaming.idleSleepEnabled}
                  onChange={(e) => updateSettings('streaming', { idleSleepMins: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
              </Field>
              <SectionTitle>{t('settings.videoRedirects')}</SectionTitle>
              <Field label={t('settings.streamDownUrl')}>
                <input className="input" value={settings.streaming.streamDownUrl}
                  onChange={(e) => updateSettings('streaming', { streamDownUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label={t('settings.bannedUserUrl')}>
                <input className="input" value={settings.streaming.bannedUserUrl}
                  onChange={(e) => updateSettings('streaming', { bannedUserUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label={t('settings.expiredUrl')}>
                <input className="input" value={settings.streaming.expiredUserUrl}
                  onChange={(e) => updateSettings('streaming', { expiredUserUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label={t('settings.countryLockUrl')}>
                <input className="input" value={settings.streaming.countryLockVideo}
                  onChange={(e) => updateSettings('streaming', { countryLockVideo: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label={t('settings.maxConnExceedUrl')}>
                <input className="input" value={settings.streaming.maxConxExceedVideo}
                  onChange={(e) => updateSettings('streaming', { maxConxExceedVideo: e.target.value })}
                  placeholder="https://..." />
              </Field>
            </div>
          </>
        )}

        {/* === SECURITY === */}
        {activeTab === 'security' && (
          <>
            <SectionTitle>{t('settings.serverGuard')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.guardEnabled')} hint={t('settings.guardEnabledHint')}>
                <Toggle checked={settings.security.enableGuard}
                  onChange={(v) => updateSettings('security', { enableGuard: v })} />
              </Field>
              <Field label={t('settings.blockDuration')}>
                <input type="number" className="input" value={settings.security.blockDuration}
                  onChange={(e) => updateSettings('security', { blockDuration: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.normalHitLimit')}>
                <input type="number" className="input" value={settings.security.maxHitsNormal}
                  onChange={(e) => updateSettings('security', { maxHitsNormal: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.restreamerHitLimit')}>
                <input type="number" className="input" value={settings.security.maxHitsRestreamer}
                  onChange={(e) => updateSettings('security', { maxHitsRestreamer: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.maxConnPerIp')}>
                <input type="number" className="input" value={settings.security.maxConnsPerIp}
                  onChange={(e) => updateSettings('security', { maxConnsPerIp: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.denyInvalidStreamIds')}>
                <Toggle checked={settings.security.denyInvalidStreamIds}
                  onChange={(v) => updateSettings('security', { denyInvalidStreamIds: v })} />
              </Field>
              <Field label={t('settings.sensitivePorts')} hint={t('settings.sensitivePortsHint')}>
                <TagInput value={settings.security.sensitivePorts}
                  onChange={(v) => updateSettings('security', { sensitivePorts: v })} />
              </Field>
              <Field label={t('settings.openPorts')} hint={t('settings.openPortsHint')}>
                <TagInput value={settings.security.openPorts}
                  onChange={(v) => updateSettings('security', { openPorts: v })} />
              </Field>
              <Field label={t('settings.whitelistIps')} hint={t('settings.whitelistIpsHint')}>
                <TagInput value={settings.security.whitelistIPs}
                  onChange={(v) => updateSettings('security', { whitelistIPs: v })}
                  placeholder="192.168.1.1, 10.0.0.0/8" />
              </Field>
            </div>
            <SectionTitle>{t('settings.panelGeoRestriction')}</SectionTitle>
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                {t('settings.geoWarning')}
              </div>
              <Field label={t('settings.geoBlockEnabled')} hint={t('settings.geoBlockEnabledHint')}>
                <Toggle checked={settings.security.geoBlockEnabled}
                  onChange={(v) => updateSettings('security', { geoBlockEnabled: v })} />
              </Field>
              <Field label={t('settings.allowedCountries')} hint={t('settings.allowedCountriesHint')}>
                <TagInput
                  value={settings.security.allowedCountries}
                  onChange={(v) => updateSettings('security', { allowedCountries: v.map((c) => c.toUpperCase()) })}
                  placeholder="TR, US, DE…"
                />
              </Field>
            </div>
            <TwoFactorSection />
          </>
        )}

        {/* === DATABASE === */}
        {activeTab === 'database' && (
          <>
            <SectionTitle>{t('settings.localBackup')}</SectionTitle>
            <div className="space-y-5">
              <Field label={t('settings.localBackupEnabled')}>
                <Toggle checked={settings.database.enableLocalBackups}
                  onChange={(v) => updateSettings('database', { enableLocalBackups: v })} />
              </Field>
              <Field label={t('settings.backupDir')}>
                <input className="input font-mono" value={settings.database.localBackupDir}
                  onChange={(e) => updateSettings('database', { localBackupDir: e.target.value })} />
              </Field>
              <Field label={t('settings.autoBackupInterval')}>
                <input type="number" className="input" value={settings.database.autoBackupIntervalHours}
                  onChange={(e) => updateSettings('database', { autoBackupIntervalHours: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label={t('settings.backupsToKeep')}>
                <input type="number" className="input" value={settings.database.backupsToKeep}
                  onChange={(e) => updateSettings('database', { backupsToKeep: parseInt(e.target.value, 10) })} />
              </Field>
              <SectionTitle>{t('settings.remoteBackup')}</SectionTitle>
              <Field label={t('settings.dropboxBackup')}>
                <Toggle checked={settings.database.enableRemoteBackup}
                  onChange={(v) => updateSettings('database', { enableRemoteBackup: v })} />
              </Field>
              <Field label={t('settings.dropboxApiKey')}>
                <input type="password" className="input font-mono" value={settings.database.dropboxApiKey}
                  onChange={(e) => updateSettings('database', { dropboxApiKey: e.target.value })}
                  placeholder="••••••••••••••••" />
              </Field>
              <Field label={t('settings.backupEncryptionKey')} hint={t('settings.backupEncryptionHint')}>
                <input type="password" className="input font-mono" value={settings.database.backupEncryptionKey}
                  onChange={(e) => updateSettings('database', { backupEncryptionKey: e.target.value })}
                  placeholder="••••••••••••••••" />
              </Field>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>{t('settings.backups')}</SectionTitle>
                <button
                  className="btn btn-primary flex items-center gap-2"
                  onClick={() => createBackup.mutate()}
                  disabled={createBackup.isPending}
                >
                  <HardDrive className="w-4 h-4" />
                  {createBackup.isPending ? t('settings.backingUp') : t('settings.backupNow')}
                </button>
              </div>

              {backupsLoading ? (
                <div className="text-sm text-muted text-center py-6">{t('common.loading')}</div>
              ) : backupList.length === 0 ? (
                <div className="text-sm text-muted text-center py-6">{t('settings.noBackups')}</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                        <th className="px-4 py-2">{t('settings.colFileName')}</th>
                        <th className="px-4 py-2">{t('settings.colSize')}</th>
                        <th className="px-4 py-2">{t('settings.colDate')}</th>
                        <th className="px-4 py-2 text-right">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupList.map((b) => (
                        <tr key={b.filename} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs text-slate-300">{b.filename}</td>
                          <td className="px-4 py-2 text-muted">{formatBytes(b.size)}</td>
                          <td className="px-4 py-2 text-muted">
                            {new Date(b.createdAt).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              {settings.database.enableRemoteBackup && settings.database.dropboxApiKey && (
                                <button
                                  title={t('settings.uploadToDropbox')}
                                  onClick={() => uploadDropbox.mutate(b.filename)}
                                  disabled={uploadDropbox.isPending}
                                  className="p-1.5 rounded hover:bg-blue-500/10 text-blue-400 transition-colors disabled:opacity-50"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                title={t('settings.download')}
                                onClick={() => { void downloadBackup(b.filename); }}
                                className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title={t('common.delete')}
                                onClick={() => setDeleteBackupFile(b.filename)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {deleteBackupFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                  <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
                    <h3 className="font-semibold text-slate-100">{t('settings.deleteBackupTitle')}</h3>
                    <p className="text-sm text-muted">
                      <span className="font-mono text-slate-300">{deleteBackupFile}</span> {t('settings.willBePermanentlyDeleted')}
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-ghost" onClick={() => setDeleteBackupFile(null)}>{t('common.cancel')}</button>
                      <button
                        className="btn btn-primary bg-red-600 hover:bg-red-700"
                        disabled={deleteBackup.isPending}
                        onClick={() => {
                          deleteBackup.mutate(deleteBackupFile, {
                            onSuccess: () => setDeleteBackupFile(null),
                          });
                        }}
                      >
                        {deleteBackup.isPending ? t('settings.deleting') : t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* === API KEYS === */}
        {activeTab === 'api' && <ApiKeyTab />}

        {/* === WHITE-LABEL === */}
        {activeTab === 'white-label' && <WhiteLabelTab />}

        {/* === AI SUPPORT === */}
        {activeTab === 'ai' && <AiSettingsTab />}

        {/* === PANEL HOSTS === */}
        {activeTab === 'panel-hosts' && <PanelHostsTab />}
      </div>
    </div>
  );
}

function AiSettingsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAiSettings();
  const saveAi = useSaveAiSettings();
  const [form, setForm] = useState<AiSettings | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (isLoading || !form) return <div className="text-sm text-muted py-6">{t('common.loading')}</div>;
  const set = (k: keyof AiSettings, v: string | boolean) => setForm((p) => (p ? { ...p, [k]: v } : p));
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start gap-2 text-xs text-muted bg-surface-2 rounded-lg p-3">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <span>{t('settings.aiDesc')}</span>
      </div>
      <Field label={t('settings.aiEnabled')}><Toggle checked={form.aiEnabled} onChange={(v) => set('aiEnabled', v)} /></Field>
      <Field label={t('settings.aiProvider')}>
        <select className="input" value={form.aiProvider} onChange={(e) => set('aiProvider', e.target.value)}>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI</option>
        </select>
      </Field>
      <Field label={t('settings.aiApiKey')} hint={t('settings.aiApiKeyHint')}>
        <input className="input font-mono" type="password" value={form.aiApiKey} onChange={(e) => set('aiApiKey', e.target.value)} placeholder="anahtar" />
      </Field>
      <Field label={t('settings.aiModel')} hint={t('settings.aiModelHint')}>
        <input className="input font-mono" value={form.aiModel} onChange={(e) => set('aiModel', e.target.value)} placeholder="claude-haiku-4-5" />
      </Field>
      <Field label={t('settings.aiSystemPrompt')} hint={t('settings.aiSystemPromptHint')}>
        <textarea className="input min-h-[90px]" value={form.aiSystemPrompt} onChange={(e) => set('aiSystemPrompt', e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={saveAi.isPending} onClick={() => saveAi.mutate(form)}>
          {saveAi.isPending ? t('settings.saving') : t('settings.save')}
        </button>
        {saveAi.isSuccess && <span className="text-xs text-emerald-400">{t('settings.saved')}</span>}
      </div>
    </div>
  );
}

function PanelHostsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = usePanelHosts();
  const save = useSavePanelHosts();
  const [form, setForm] = useState<PanelHosts | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);
  if (isLoading || !form) return <div className="text-sm text-muted py-6">{t('common.loading')}</div>;
  const set = (k: keyof PanelHosts, v: string) => setForm((p) => (p ? { ...p, [k]: v.trim() } : p));
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start gap-2 text-xs text-muted bg-surface-2 rounded-lg p-3">
        <Link2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
<span>{t('settings.panelHostsDesc')}</span>
      </div>
      <Field label={t('settings.resellerHost')} hint={t('settings.resellerHostHint')}>
        <input className="input font-mono" value={form.resellerPanelHost}
          onChange={(e) => set('resellerPanelHost', e.target.value)} placeholder="bayi.ornek.com" />
      </Field>
      <Field label={t('settings.clientHost')} hint={t('settings.clientHostHint')}>
        <input className="input font-mono" value={form.clientPanelHost}
          onChange={(e) => set('clientPanelHost', e.target.value)} placeholder="uye.ornek.com" />
      </Field>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(form)}>
          {save.isPending ? t('settings.saving') : t('settings.save')}
        </button>
        {save.isSuccess && <span className="text-xs text-emerald-400">{t('settings.savedRefresh')}</span>}
      </div>
    </div>
  );
}

const PERM_OPTIONS = ['read', 'write', 'admin'];

function ApiKeyTab() {
  const { t } = useTranslation();
  const { data: keys } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(['read']);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const res = await createKey.mutateAsync({ name, permissions });
    setNewKey(res.data.data.key);
    setShowCreate(false);
    setName('');
    setPermissions(['read']);
  };

  const handleCopy = () => {
    if (!newKey) return;
    void copyToClipboard(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>{t('settings.apiKeys')}</SectionTitle>
        <button className="btn-primary text-sm px-3 py-1.5" onClick={() => setShowCreate(true)}>
          + {t('settings.newKey')}
        </button>
      </div>

      {newKey && (
        <div className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/5 space-y-2">
          <p className="text-sm text-green-400 font-semibold">{t('settings.newApiKeyShown')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-slate-200 bg-surface p-2 rounded-lg break-all">{newKey}</code>
            <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-surface-2 text-muted">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button className="text-xs text-muted hover:text-slate-300" onClick={() => setNewKey(null)}>{t('common.close')}</button>
        </div>
      )}

      <div className="space-y-2">
        {(keys ?? []).map((k) => (
          <div key={k.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
            <Key className="w-4 h-4 text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200">{k.name}</div>
              <div className="text-xs text-muted font-mono">{k.key}</div>
              <div className="flex gap-2 mt-1">
                {k.permissions.map((p) => (
                  <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary-light">{p}</span>
                ))}
              </div>
            </div>
            <div className="text-right text-xs text-muted space-y-0.5">
              <div>{t('settings.createdColon')} {new Date(k.createdAt).toLocaleDateString('tr-TR')}</div>
              {k.lastUsedAt && <div>{t('settings.lastUsedColon')} {new Date(k.lastUsedAt).toLocaleDateString('tr-TR')}</div>}
            </div>
            <button
              onClick={() => deleteKey.mutate(k.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {(!keys || keys.length === 0) && (
          <div className="text-center text-muted text-sm py-8">{t('settings.noApiKeys')}</div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold text-slate-100">{t('settings.newApiKeyTitle')}</h3>
            <div>
              <label className="label">{t('common.name')}</label>
              <input className="input" placeholder={t('settings.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('settings.permissions')}</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {PERM_OPTIONS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={permissions.includes(p)}
                      onChange={(e) => setPermissions(e.target.checked ? [...permissions, p] : permissions.filter((x) => x !== p))}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
              <button
                className="btn-primary"
                disabled={!name || createKey.isPending}
                onClick={() => void handleCreate()}
              >
                {createKey.isPending ? t('settings.creating') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── White-Label Tab ──────────────────────────────────────────────────────────

function WhiteLabelTab() {
  const { t } = useTranslation();
  const { data: config } = useWhiteLabel();
  const updateWl = useUpdateWhiteLabel();
  const uploadLogo = useUploadLogo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({
    panelName: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    customDomain: '',
    footerText: '',
    supportEmail: '',
    supportUrl: '',
    customCss: '',
  });
  const [formInit, setFormInit] = useState(false);

  if (config && !formInit) {
    setForm({
      panelName: config.panelName ?? '',
      primaryColor: config.primaryColor ?? '#6366f1',
      secondaryColor: config.secondaryColor ?? '#8b5cf6',
      customDomain: config.customDomain ?? '',
      footerText: config.footerText ?? '',
      supportEmail: config.supportEmail ?? '',
      supportUrl: config.supportUrl ?? '',
      customCss: config.customCss ?? '',
    });
    setFormInit(true);
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <SectionTitle>{t('settings.whiteLabelSettings')}</SectionTitle>

      <div className="mb-6">
        <label className="label mb-2">{t('settings.logo')}</label>
        <div
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) uploadLogo.mutate(file); }}
          onDragOver={(e) => e.preventDefault()}
        >
          {config?.logoUrl ? (
            <img src={config.logoUrl} alt="logo" className="h-12 mx-auto mb-2 object-contain" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted mx-auto mb-2" />
          )}
          <p className="text-sm text-muted">{t('settings.dragDropHint')}</p>
          {uploadLogo.isPending && <p className="text-xs text-primary mt-1">{t('common.loading')}</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo.mutate(file); }} />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">{t('settings.panelName')}</label>
            <input className="input" value={form.panelName} onChange={f('panelName')} placeholder="XtreamPulsar" /></div>
          <div><label className="label">{t('settings.customDomain')}</label>
            <input className="input" value={form.customDomain} onChange={f('customDomain')} placeholder="panel.sirketniz.com" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">{t('settings.primaryColor')}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.primaryColor} onChange={f('primaryColor')} className="h-9 w-12 rounded cursor-pointer border border-border bg-transparent" />
              <input className="input flex-1 font-mono" value={form.primaryColor} onChange={f('primaryColor')} />
            </div></div>
          <div><label className="label">{t('settings.secondaryColor')}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.secondaryColor} onChange={f('secondaryColor')} className="h-9 w-12 rounded cursor-pointer border border-border bg-transparent" />
              <input className="input flex-1 font-mono" value={form.secondaryColor} onChange={f('secondaryColor')} />
            </div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">{t('settings.supportEmail')}</label>
            <input className="input" value={form.supportEmail} onChange={f('supportEmail')} /></div>
          <div><label className="label">{t('settings.supportUrl')}</label>
            <input className="input" value={form.supportUrl} onChange={f('supportUrl')} /></div>
        </div>
        <div><label className="label">{t('settings.footerText')}</label>
          <input className="input" value={form.footerText} onChange={f('footerText')} /></div>
        <div><label className="label">{t('settings.customCss')}</label>
          <textarea className="input font-mono text-xs resize-y" rows={4} value={form.customCss} onChange={f('customCss')}
            placeholder=":root { --color-primary: #6366f1; }" /></div>

        <div className="flex gap-2 pt-2">
          <button className="btn-ghost" onClick={() => setShowPreview(true)}>{t('settings.preview')}</button>
          <button className="btn-primary flex items-center gap-2" disabled={updateWl.isPending} onClick={() => updateWl.mutate(form)}>
            <Save className="w-4 h-4" />
            {updateWl.isPending ? t('settings.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPreview(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4" style={{ color: form.primaryColor }}>{form.panelName || t('settings.panelName')}</h3>
            <div className="space-y-2">
              <div className="h-8 rounded-lg" style={{ background: form.primaryColor, opacity: 0.8 }} />
              <div className="h-4 rounded" style={{ background: form.secondaryColor, opacity: 0.5, width: '60%' }} />
              <div className="h-4 rounded bg-border w-3/4" />
            </div>
            {config?.logoUrl && <img src={config.logoUrl} alt="preview" className="h-10 object-contain mt-4" />}
            <p className="text-xs text-muted mt-4 text-center">{form.footerText}</p>
            <button className="mt-4 text-xs text-muted hover:text-fg" onClick={() => setShowPreview(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Reseller Tab ────────────────────────────────────────────────────────────

function ResellerTab({
  settings,
  updateSettings,
}: {
  settings: ReturnType<typeof useSettings>;
  updateSettings: <K extends keyof ReturnType<typeof useSettings>>(tab: K, values: Partial<ReturnType<typeof useSettings>[K]>) => void;
}) {
  const { t } = useTranslation();
  const cp = settings.reseller.creditPricing ?? DEFAULT_CREDIT_PRICING;

  function updateDurationCredits(index: number, credits: number) {
    const durations = cp.durations.map((d, i) => (i === index ? { ...d, credits } : d));
    updateSettings('reseller', { creditPricing: { ...cp, durations } });
  }

  function updateTestDurationCredits(index: number, credits: number) {
    const testDurations = cp.testDurations.map((d, i) => (i === index ? { ...d, credits } : d));
    updateSettings('reseller', { creditPricing: { ...cp, testDurations } });
  }

  function updateCustomPricing(patch: Partial<CreditPricingConfig['customPricing']>) {
    updateSettings('reseller', {
      creditPricing: { ...cp, customPricing: { ...cp.customPricing, ...patch } },
    });
  }

  const customDaysPreview = Math.max(1, Math.ceil(25 * (cp.customPricing?.creditsPerDay ?? 0.1)));

  return (
    <>
      <SectionTitle>{t('settings.resellerManagement')}</SectionTitle>
      <div className="space-y-5">
        <Field label={t('settings.registrationOpen')} hint={t('settings.registrationOpenHint')}>
          <Toggle
            checked={settings.reseller.registrationOpen}
            onChange={(v) => updateSettings('reseller', { registrationOpen: v })}
          />
        </Field>
        <Field label={t('settings.minCreditWarning')} hint={t('settings.minCreditWarningHint')}>
          <input
            type="number"
            className="input"
            value={settings.reseller.minCreditWarning}
            onChange={(e) => updateSettings('reseller', { minCreditWarning: parseInt(e.target.value, 10) })}
          />
        </Field>
      </div>

      <SectionTitle>{t('settings.tierCreditMultiplier')}</SectionTitle>
      <div className="space-y-5">
        <p className="text-xs text-muted">
          {t('settings.tierMultiplierDesc')}
        </p>
        {(['BASIC', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
          <Field key={tier} label={t('settings.tierMultiplierLabel', { tier })}>
            <input
              type="number"
              className="input"
              min={1}
              step={0.1}
              value={settings.reseller.tierPricing[tier] ?? 1}
              onChange={(e) =>
                updateSettings('reseller', {
                  tierPricing: { ...settings.reseller.tierPricing, [tier]: parseFloat(e.target.value) || 1 },
                })
              }
            />
          </Field>
        ))}
      </div>

      <SectionTitle>{t('settings.creditPricing')}</SectionTitle>

      <p className="text-xs text-muted mb-4">
        {t('settings.creditPricingDesc')}
      </p>

      <div className="mb-6">
        <h4 className="text-sm font-medium mb-3">{t('settings.standardDurations')}</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-2 text-muted font-normal">{t('settings.colDuration')}</th>
                <th className="text-left px-4 py-2 text-muted font-normal">{t('settings.colCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {cp.durations.map((d, i) => (
                <tr key={d.days} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{d.label}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-24"
                      value={d.credits}
                      onChange={(e) => updateDurationCredits(i, parseInt(e.target.value, 10) || 0)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-medium mb-3">{t('settings.testDurations')}</h4>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-2 text-muted font-normal">{t('settings.colDuration')}</th>
                <th className="text-left px-4 py-2 text-muted font-normal">{t('settings.colCredit')}</th>
              </tr>
            </thead>
            <tbody>
              {cp.testDurations.map((d, i) => (
                <tr key={d.hours} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{d.label}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-24"
                      value={d.credits}
                      onChange={(e) => updateTestDurationCredits(i, parseInt(e.target.value, 10) || 0)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium">{t('settings.customPricing')}</h4>
        <Field label={t('settings.customPricingActive')} hint={t('settings.customPricingActiveHint')}>
          <Toggle
            checked={cp.customPricing?.enabled ?? false}
            onChange={(v) => updateCustomPricing({ enabled: v })}
          />
        </Field>
        {cp.customPricing?.enabled && (
          <Field label={t('settings.creditsPerDay')} hint={t('settings.creditsPerDayHint')}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0.01}
                step={0.01}
                className="input w-28"
                value={cp.customPricing.creditsPerDay ?? 0.1}
                onChange={(e) => updateCustomPricing({ creditsPerDay: parseFloat(e.target.value) || 0.1 })}
              />
              <span className="text-xs text-muted">{t('settings.daysPreview', { n: customDaysPreview })}</span>
            </div>
          </Field>
        )}
      </div>
    </>
  );
}
