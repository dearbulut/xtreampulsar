import { useState } from 'react';
import { Save, RotateCcw, Globe, Tv, Users, Radio, Shield, Database } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { TagInput } from '@/components/ui/TagInput';
import { useSettings, useUpdateSettings, useSyncSettings, useSaveSettings } from '@/hooks/useSettings';
import toast from 'react-hot-toast';

const SETTINGS_TABS: TabItem[] = [
  { id: 'general', label: 'Genel', icon: Globe },
  { id: 'xtream', label: 'Xtream', icon: Tv },
  { id: 'reseller', label: 'Reseller', icon: Users },
  { id: 'streaming', label: 'Streaming', icon: Radio },
  { id: 'security', label: 'Güvenlik', icon: Shield },
  { id: 'database', label: 'Veritabanı', icon: Database },
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

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  useSyncSettings();
  const saveSettings = useSaveSettings();

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
          </>
        )}
      </div>
    </div>
  );
}
