import { useState, useRef } from 'react';
import { Save, RotateCcw, Globe, Tv, Users, Radio, Shield, Database, HardDrive, Trash2, Upload, Download, Bell, Key, Copy, Check, Palette, Image as ImageIcon } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { TagInput } from '@/components/ui/TagInput';
import { useSettings, useUpdateSettings, useSyncSettings, useSaveSettings } from '@/hooks/useSettings';
import { useBackupList, useCreateBackup, useDeleteBackup, useUploadDropbox, useDownloadBackup, formatBytes } from '@/hooks/useBackup';
import { use2FASetup, use2FAEnable, use2FADisable } from '@/hooks/useTwoFactor';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useWhiteLabel, useUpdateWhiteLabel, useUploadLogo } from '@/hooks/useWhiteLabel';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

const SETTINGS_TABS: TabItem[] = [
  { id: 'general', label: 'Genel', icon: Globe },
  { id: 'xtream', label: 'Xtream', icon: Tv },
  { id: 'reseller', label: 'Reseller', icon: Users },
  { id: 'streaming', label: 'Streaming', icon: Radio },
  { id: 'security', label: 'Güvenlik', icon: Shield },
  { id: 'database', label: 'Veritabanı', icon: Database },
  { id: 'api', label: 'API', icon: Key },
  { id: 'white-label', label: 'White-Label', icon: Palette },
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
  const [showSetup, setShowSetup] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);

  const setup = use2FASetup(showSetup);
  const enableMut = use2FAEnable();
  const disableMut = use2FADisable();

  const handleEnable = async () => {
    await enableMut.mutateAsync(code);
    setEnabled(true);
    setShowSetup(false);
    setCode('');
  };

  const handleDisable = async () => {
    await disableMut.mutateAsync(password);
    setEnabled(false);
    setPassword('');
  };

  return (
    <div className="mt-2">
      <SectionTitle>İki Faktörlü Doğrulama (2FA)</SectionTitle>
      <div className="space-y-4">
        {!enabled ? (
          <>
            {!showSetup ? (
              <button className="btn-secondary text-sm" onClick={() => setShowSetup(true)}>
                2FA Kurulumunu Başlat
              </button>
            ) : (
              <div className="space-y-4 p-4 rounded-xl bg-surface border border-border">
                {setup.isLoading && <p className="text-muted text-sm">QR kodu yükleniyor…</p>}
                {setup.data && (
                  <>
                    <p className="text-sm text-slate-300">Authenticator uygulamanızla QR kodu tarayın:</p>
                    <img src={setup.data.qrCodeImage} alt="2FA QR" className="w-44 h-44 rounded-lg" />
                    <p className="text-xs text-muted font-mono break-all">{setup.data.secret}</p>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="6 haneli kod"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                      />
                      <button
                        className="btn-primary text-sm px-4"
                        disabled={enableMut.isPending || code.length !== 6}
                        onClick={() => void handleEnable()}
                      >
                        Onayla
                      </button>
                    </div>
                  </>
                )}
                <button className="text-sm text-muted hover:text-slate-300" onClick={() => setShowSetup(false)}>İptal</button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-surface border border-border">
            <p className="text-sm text-green-400">2FA etkin</p>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="btn-danger text-sm px-4"
                disabled={disableMut.isPending}
                onClick={() => void handleDisable()}
              >
                Devre Dışı Bırak
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
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
          <h1 className="text-2xl font-bold text-slate-100">Ayarlar</h1>
          <p className="text-sm text-muted mt-0.5">Panel ve sistem yapılandırması</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => toast('Varsayılanlara döndürüldü', { icon: '↺' })}>
            <RotateCcw className="w-4 h-4" /> Sıfırla
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saveSettings.isPending}>
            <Save className="w-4 h-4" /> {saveSettings.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      <Tabs tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="card p-6 space-y-6">

        {/* === GENERAL === */}
        {activeTab === 'general' && (
          <>
            <SectionTitle>Panel Ayarları</SectionTitle>
            <div className="space-y-5">
              <Field label="Panel Adı" hint="Tarayıcı sekmesinde görünür">
                <input className="input" value={settings.general.panelName}
                  onChange={(e) => updateSettings('general', { panelName: e.target.value })} />
              </Field>
              <Field label="Saat Dilimi">
                <select className="input" value={settings.general.timezone}
                  onChange={(e) => updateSettings('general', { timezone: e.target.value })}>
                  {['Europe/Istanbul', 'UTC', 'Europe/London', 'America/New_York'].map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sunucu URL" hint="Xtream Kodları bağlantısı için">
                <input className="input" value={settings.general.serverUrl}
                  onChange={(e) => updateSettings('general', { serverUrl: e.target.value })}
                  placeholder="http://panel.example.com" />
              </Field>
              <Field label="Logo URL">
                <input className="input" value={settings.general.logoUrl}
                  onChange={(e) => updateSettings('general', { logoUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
            </div>
            <SectionTitle>Bildirimler</SectionTitle>
            <div className="space-y-5">
              <Field label="Admin E-posta" hint="Stream çöküş bildirimleri bu adrese gönderilir">
                <input className="input" type="email" value={settings.general.adminEmail}
                  onChange={(e) => updateSettings('general', { adminEmail: e.target.value })}
                  placeholder="admin@example.com" />
              </Field>
              <Field label="Stream Çöküş Uyarısı" hint="Stream CRASHED olduğunda e-posta gönder">
                <Toggle checked={settings.general.streamDownAlert}
                  onChange={(v) => updateSettings('general', { streamDownAlert: v })} />
              </Field>
              <Field label="Reseller Sona Erme Bildirimi" hint="Kullanıcı 3 gün içinde dolacaksa reseller'a bildir">
                <Toggle checked={settings.general.resellerNotifyExpiry}
                  onChange={(v) => updateSettings('general', { resellerNotifyExpiry: v })} />
              </Field>
            </div>
            <SectionTitle>Discord Bildirimleri</SectionTitle>
            <div className="space-y-5">
              <Field label="Discord Webhook URL">
                <input className="input" value={settings.general.discordWebhookUrl}
                  onChange={(e) => updateSettings('general', { discordWebhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..." />
              </Field>
              <Field label="Discord Alarmları Aktif">
                <Toggle checked={settings.general.discordAlerts}
                  onChange={(v) => updateSettings('general', { discordAlerts: v })} />
              </Field>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => api.post('/notifications/test-discord').then(() => toast.success('Discord test gönderildi')).catch(() => toast.error('Discord test başarısız'))}
              >
                Discord Test Gönder
              </button>
            </div>
            <SectionTitle>Telegram Bildirimleri</SectionTitle>
            <div className="space-y-5">
              <Field label="Telegram Bot Token">
                <input className="input" value={settings.general.telegramBotToken}
                  onChange={(e) => updateSettings('general', { telegramBotToken: e.target.value })}
                  placeholder="123456789:ABC..." />
              </Field>
              <Field label="Telegram Chat ID">
                <input className="input" value={settings.general.telegramChatId}
                  onChange={(e) => updateSettings('general', { telegramChatId: e.target.value })}
                  placeholder="-1001234567890" />
              </Field>
              <Field label="Telegram Alarmları Aktif">
                <Toggle checked={settings.general.telegramAlerts}
                  onChange={(v) => updateSettings('general', { telegramAlerts: v })} />
              </Field>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => api.post('/notifications/test-telegram').then(() => toast.success('Telegram test gönderildi')).catch(() => toast.error('Telegram test başarısız'))}
              >
                Telegram Test Gönder
              </button>
            </div>
          </>
        )}

        {/* === XTREAM === */}
        {activeTab === 'xtream' && (
          <>
            <SectionTitle>Xtream Kodları API</SectionTitle>
            <div className="space-y-5">
              <Field label="HTTP Port">
                <input type="number" className="input" value={settings.xtream.port}
                  onChange={(e) => updateSettings('xtream', { port: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="HTTPS Port">
                <input type="number" className="input" value={settings.xtream.httpsPort}
                  onChange={(e) => updateSettings('xtream', { httpsPort: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Çıkış Formatları" hint="Desteklenen oynatma formatları">
                <TagInput
                  value={settings.xtream.outputFormats}
                  onChange={(v) => updateSettings('xtream', { outputFormats: v })}
                  placeholder="m3u8, ts, rtmp…"
                />
              </Field>
              <Field label="Deneme Kullanıcı Limiti" hint="0 = sınırsız">
                <input type="number" className="input" value={settings.xtream.trialUserLimit}
                  onChange={(e) => updateSettings('xtream', { trialUserLimit: parseInt(e.target.value, 10) })} />
              </Field>
            </div>

            <SectionTitle>Trial Ayarları</SectionTitle>
            <div className="space-y-5">
              <Field label="Varsayılan Trial Süresi (gün)" hint="'Trial Ekle' butonunda varsayılan süre">
                <input type="number" min={1} max={90} className="input" value={settings.xtream.trialDays}
                  onChange={(e) => updateSettings('xtream', { trialDays: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Varsayılan Max Bağlantı" hint="Trial hesaplar için maksimum eş zamanlı bağlantı">
                <input type="number" min={1} max={5} className="input" value={settings.xtream.trialMaxConnections}
                  onChange={(e) => updateSettings('xtream', { trialMaxConnections: parseInt(e.target.value, 10) })} />
              </Field>
            </div>
          </>
        )}

        {/* === RESELLER === */}
        {activeTab === 'reseller' && (
          <>
            <SectionTitle>Reseller Yönetimi</SectionTitle>
            <div className="space-y-5">
              <Field label="Kayıt Açık" hint="Yeni reseller kaydına izin ver">
                <Toggle
                  checked={settings.reseller.registrationOpen}
                  onChange={(v) => updateSettings('reseller', { registrationOpen: v })}
                />
              </Field>
              <Field label="Min Kredi Uyarısı" hint="Bu değerin altına düşünce uyarı">
                <input type="number" className="input" value={settings.reseller.minCreditWarning}
                  onChange={(e) => updateSettings('reseller', { minCreditWarning: parseInt(e.target.value, 10) })} />
              </Field>
            </div>
            <SectionTitle>Tier Bazlı Kredi Çarpanı</SectionTitle>
            <div className="space-y-5">
              <p className="text-xs text-muted">Reseller'ın tier'ına göre işlem başına düşülecek kredi miktarı çarpılır. 1 = standart, 2 = 2 kat kredi.</p>
              {(['BASIC', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((tier) => (
                <Field key={tier} label={`${tier} Çarpanı`}>
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
          </>
        )}

        {/* === STREAMING === */}
        {activeTab === 'streaming' && (
          <>
            <SectionTitle>FFmpeg & HLS</SectionTitle>
            <div className="space-y-5">
              <Field label="FFmpeg Yolu">
                <input className="input font-mono" value={settings.streaming.ffmpegPath}
                  onChange={(e) => updateSettings('streaming', { ffmpegPath: e.target.value })} />
              </Field>
              <Field label="HLS Segment Süresi (s)">
                <input type="number" className="input" value={settings.streaming.hlsTime}
                  onChange={(e) => updateSettings('streaming', { hlsTime: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="HLS Liste Boyutu">
                <input type="number" className="input" value={settings.streaming.hlsListSize}
                  onChange={(e) => updateSettings('streaming', { hlsListSize: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Buffer Boyutu (KB)">
                <input type="number" className="input" value={settings.streaming.bufferSize}
                  onChange={(e) => updateSettings('streaming', { bufferSize: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="VOD İndirme Hızı">
                <input type="number" className="input" value={settings.streaming.vodDownloadSpeed}
                  onChange={(e) => updateSettings('streaming', { vodDownloadSpeed: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="VOD İndirme Limiti">
                <input type="number" className="input" value={settings.streaming.vodDownloadLimit}
                  onChange={(e) => updateSettings('streaming', { vodDownloadLimit: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="VPN Engelle">
                <Toggle checked={settings.streaming.blockVPN}
                  onChange={(v) => updateSettings('streaming', { blockVPN: v })} />
              </Field>
              <Field label="Öncelikli Yedek Stream">
                <Toggle checked={settings.streaming.priorityBackupStream}
                  onChange={(v) => updateSettings('streaming', { priorityBackupStream: v })} />
              </Field>
              <Field label="Admin Streaming IP'leri">
                <TagInput value={settings.streaming.adminStreamingIps}
                  onChange={(v) => updateSettings('streaming', { adminStreamingIps: v })}
                  placeholder="192.168.1.1..." />
              </Field>
              <Field label="Anlık Bağlantı Kapat">
                <Toggle checked={settings.streaming.instantCloseConn}
                  onChange={(v) => updateSettings('streaming', { instantCloseConn: v })} />
              </Field>
              <Field label="Bağlantı Aşım Log">
                <Toggle checked={settings.streaming.enableConxExceedLog}
                  onChange={(v) => updateSettings('streaming', { enableConxExceedLog: v })} />
              </Field>
              <SectionTitle>Video Yönlendirmeleri</SectionTitle>
              <Field label="Stream Çevrimdışı URL">
                <input className="input" value={settings.streaming.streamDownUrl}
                  onChange={(e) => updateSettings('streaming', { streamDownUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label="Banlı Kullanıcı URL">
                <input className="input" value={settings.streaming.bannedUserUrl}
                  onChange={(e) => updateSettings('streaming', { bannedUserUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label="Süresi Dolmuş URL">
                <input className="input" value={settings.streaming.expiredUserUrl}
                  onChange={(e) => updateSettings('streaming', { expiredUserUrl: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label="Ülke Kısıtlama URL">
                <input className="input" value={settings.streaming.countryLockVideo}
                  onChange={(e) => updateSettings('streaming', { countryLockVideo: e.target.value })}
                  placeholder="https://..." />
              </Field>
              <Field label="Maks Bağlantı Aşım URL">
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
            <SectionTitle>Server Guard</SectionTitle>
            <div className="space-y-5">
              <Field label="Guard Etkin" hint="Otomatik IP bloklama">
                <Toggle checked={settings.security.enableGuard}
                  onChange={(v) => updateSettings('security', { enableGuard: v })} />
              </Field>
              <Field label="Blok Süresi (dk)">
                <input type="number" className="input" value={settings.security.blockDuration}
                  onChange={(e) => updateSettings('security', { blockDuration: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Normal Hit Limiti">
                <input type="number" className="input" value={settings.security.maxHitsNormal}
                  onChange={(e) => updateSettings('security', { maxHitsNormal: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Restreamer Hit Limiti">
                <input type="number" className="input" value={settings.security.maxHitsRestreamer}
                  onChange={(e) => updateSettings('security', { maxHitsRestreamer: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="IP Başına Maks Bağlantı">
                <input type="number" className="input" value={settings.security.maxConnsPerIp}
                  onChange={(e) => updateSettings('security', { maxConnsPerIp: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Geçersiz Stream ID'yi Engelle">
                <Toggle checked={settings.security.denyInvalidStreamIds}
                  onChange={(v) => updateSettings('security', { denyInvalidStreamIds: v })} />
              </Field>
              <Field label="Hassas Portlar" hint="Guard'ın koruyacağı portlar">
                <TagInput value={settings.security.sensitivePorts}
                  onChange={(v) => updateSettings('security', { sensitivePorts: v })} />
              </Field>
              <Field label="Açık Portlar" hint="İzin verilen portlar">
                <TagInput value={settings.security.openPorts}
                  onChange={(v) => updateSettings('security', { openPorts: v })} />
              </Field>
              <Field label="Whitelist IP'ler" hint="Asla engellenmeyen IP'ler">
                <TagInput value={settings.security.whitelistIPs}
                  onChange={(v) => updateSettings('security', { whitelistIPs: v })}
                  placeholder="192.168.1.1, 10.0.0.0/8" />
              </Field>
            </div>
            <SectionTitle>Panel Coğrafi Erişim Kısıtlaması</SectionTitle>
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                ⚠ Bu ayar yalnızca admin panelini etkiler. Kendi ülkeni mutlaka listeye ekle; yoksa panelden kilitlenirsin!
              </div>
              <Field label="Coğrafi Engelleme Aktif" hint="Admin paneline sadece izin verilen ülkelerden erişilsin">
                <Toggle checked={settings.security.geoBlockEnabled}
                  onChange={(v) => updateSettings('security', { geoBlockEnabled: v })} />
              </Field>
              <Field label="İzin Verilen Ülkeler" hint="ISO 3166-1 alfa-2 kodları (TR, US, DE…)">
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
            <SectionTitle>Yerel Yedekleme</SectionTitle>
            <div className="space-y-5">
              <Field label="Yerel Yedekleme Etkin">
                <Toggle checked={settings.database.enableLocalBackups}
                  onChange={(v) => updateSettings('database', { enableLocalBackups: v })} />
              </Field>
              <Field label="Yedekleme Dizini">
                <input className="input font-mono" value={settings.database.localBackupDir}
                  onChange={(e) => updateSettings('database', { localBackupDir: e.target.value })} />
              </Field>
              <Field label="Otomatik Yedek Aralığı (saat)">
                <input type="number" className="input" value={settings.database.autoBackupIntervalHours}
                  onChange={(e) => updateSettings('database', { autoBackupIntervalHours: parseInt(e.target.value, 10) })} />
              </Field>
              <Field label="Saklanacak Yedek Sayısı">
                <input type="number" className="input" value={settings.database.backupsToKeep}
                  onChange={(e) => updateSettings('database', { backupsToKeep: parseInt(e.target.value, 10) })} />
              </Field>
              <SectionTitle>Uzak Yedekleme</SectionTitle>
              <Field label="Dropbox Yedekleme">
                <Toggle checked={settings.database.enableRemoteBackup}
                  onChange={(v) => updateSettings('database', { enableRemoteBackup: v })} />
              </Field>
              <Field label="Dropbox API Anahtarı">
                <input type="password" className="input font-mono" value={settings.database.dropboxApiKey}
                  onChange={(e) => updateSettings('database', { dropboxApiKey: e.target.value })}
                  placeholder="••••••••••••••••" />
              </Field>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Yedekler</SectionTitle>
                <button
                  className="btn btn-primary flex items-center gap-2"
                  onClick={() => createBackup.mutate()}
                  disabled={createBackup.isPending}
                >
                  <HardDrive className="w-4 h-4" />
                  {createBackup.isPending ? 'Yedekleniyor…' : 'Şimdi Yedekle'}
                </button>
              </div>

              {backupsLoading ? (
                <div className="text-sm text-muted text-center py-6">Yükleniyor…</div>
              ) : backupList.length === 0 ? (
                <div className="text-sm text-muted text-center py-6">Henüz yedek yok.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                        <th className="px-4 py-2">Dosya Adı</th>
                        <th className="px-4 py-2">Boyut</th>
                        <th className="px-4 py-2">Tarih</th>
                        <th className="px-4 py-2 text-right">İşlemler</th>
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
                                  title="Dropbox'a Yükle"
                                  onClick={() => uploadDropbox.mutate(b.filename)}
                                  disabled={uploadDropbox.isPending}
                                  className="p-1.5 rounded hover:bg-blue-500/10 text-blue-400 transition-colors disabled:opacity-50"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                title="İndir"
                                onClick={() => { void downloadBackup(b.filename); }}
                                className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Sil"
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
                    <h3 className="font-semibold text-slate-100">Yedeği Sil</h3>
                    <p className="text-sm text-muted">
                      <span className="font-mono text-slate-300">{deleteBackupFile}</span> kalıcı olarak silinecek.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button className="btn btn-ghost" onClick={() => setDeleteBackupFile(null)}>İptal</button>
                      <button
                        className="btn btn-primary bg-red-600 hover:bg-red-700"
                        disabled={deleteBackup.isPending}
                        onClick={() => {
                          deleteBackup.mutate(deleteBackupFile, {
                            onSuccess: () => setDeleteBackupFile(null),
                          });
                        }}
                      >
                        {deleteBackup.isPending ? 'Siliniyor…' : 'Sil'}
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
      </div>
    </div>
  );
}

const PERM_OPTIONS = ['read', 'write', 'admin'];

function ApiKeyTab() {
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
    void navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle>API Anahtarları</SectionTitle>
        <button className="btn-primary text-sm px-3 py-1.5" onClick={() => setShowCreate(true)}>
          + Yeni Anahtar
        </button>
      </div>

      {newKey && (
        <div className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/5 space-y-2">
          <p className="text-sm text-green-400 font-semibold">Yeni API Anahtarınız (bir kez gösterilir):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-slate-200 bg-surface p-2 rounded-lg break-all">{newKey}</code>
            <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-surface-2 text-muted">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button className="text-xs text-muted hover:text-slate-300" onClick={() => setNewKey(null)}>Kapat</button>
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
              <div>Oluşturuldu: {new Date(k.createdAt).toLocaleDateString('tr-TR')}</div>
              {k.lastUsedAt && <div>Son kullanım: {new Date(k.lastUsedAt).toLocaleDateString('tr-TR')}</div>}
            </div>
            <button
              onClick={() => deleteKey.mutate(k.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
              title="Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {(!keys || keys.length === 0) && (
          <div className="text-center text-muted text-sm py-8">Henüz API anahtarı yok</div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold text-slate-100">Yeni API Anahtarı</h3>
            <div>
              <label className="label">Ad</label>
              <input className="input" placeholder="CI/CD entegrasyonu" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">İzinler</label>
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
              <button className="btn-ghost" onClick={() => setShowCreate(false)}>İptal</button>
              <button
                className="btn-primary"
                disabled={!name || createKey.isPending}
                onClick={() => void handleCreate()}
              >
                {createKey.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
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
      <SectionTitle>White-Label Ayarları</SectionTitle>

      <div className="mb-6">
        <label className="label mb-2">Logo</label>
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
          <p className="text-sm text-muted">Sürükle & bırak veya tıkla (max 2MB)</p>
          {uploadLogo.isPending && <p className="text-xs text-primary mt-1">Yükleniyor…</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadLogo.mutate(file); }} />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Panel Adı</label>
            <input className="input" value={form.panelName} onChange={f('panelName')} placeholder="XtreamPulsar" /></div>
          <div><label className="label">Özel Domain</label>
            <input className="input" value={form.customDomain} onChange={f('customDomain')} placeholder="panel.sirketniz.com" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Birincil Renk</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.primaryColor} onChange={f('primaryColor')} className="h-9 w-12 rounded cursor-pointer border border-border bg-transparent" />
              <input className="input flex-1 font-mono" value={form.primaryColor} onChange={f('primaryColor')} />
            </div></div>
          <div><label className="label">İkincil Renk</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.secondaryColor} onChange={f('secondaryColor')} className="h-9 w-12 rounded cursor-pointer border border-border bg-transparent" />
              <input className="input flex-1 font-mono" value={form.secondaryColor} onChange={f('secondaryColor')} />
            </div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Destek E-posta</label>
            <input className="input" value={form.supportEmail} onChange={f('supportEmail')} /></div>
          <div><label className="label">Destek URL</label>
            <input className="input" value={form.supportUrl} onChange={f('supportUrl')} /></div>
        </div>
        <div><label className="label">Footer Metni</label>
          <input className="input" value={form.footerText} onChange={f('footerText')} /></div>
        <div><label className="label">Özel CSS</label>
          <textarea className="input font-mono text-xs resize-y" rows={4} value={form.customCss} onChange={f('customCss')}
            placeholder=":root { --color-primary: #6366f1; }" /></div>

        <div className="flex gap-2 pt-2">
          <button className="btn-ghost" onClick={() => setShowPreview(true)}>Önizle</button>
          <button className="btn-primary flex items-center gap-2" disabled={updateWl.isPending} onClick={() => updateWl.mutate(form)}>
            <Save className="w-4 h-4" />
            {updateWl.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPreview(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4" style={{ color: form.primaryColor }}>{form.panelName || 'Panel Adı'}</h3>
            <div className="space-y-2">
              <div className="h-8 rounded-lg" style={{ background: form.primaryColor, opacity: 0.8 }} />
              <div className="h-4 rounded" style={{ background: form.secondaryColor, opacity: 0.5, width: '60%' }} />
              <div className="h-4 rounded bg-border w-3/4" />
            </div>
            {config?.logoUrl && <img src={config.logoUrl} alt="preview" className="h-10 object-contain mt-4" />}
            <p className="text-xs text-muted mt-4 text-center">{form.footerText}</p>
            <button className="mt-4 text-xs text-muted hover:text-fg" onClick={() => setShowPreview(false)}>Kapat</button>
          </div>
        </div>
      )}
    </>
  );
}
