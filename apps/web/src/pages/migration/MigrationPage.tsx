import { useState } from 'react';
import {
  Database,
  Link2,
  FileText,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Tv,
  Users,
  Store,
  Package,
  BookMarked,
  Radio,
} from 'lucide-react';
import { Wizard, type WizardStep } from '@/components/ui/Wizard';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  useUploadDump,
  usePreviewDump,
  useStartDumpImport,
  useImportM3U,
  useImportXtream,
  useMigrationJobs,
  useMigrationJob,
  type MigrationJob,
  type DumpPreview,
  type DumpImportOptions,
} from '@/hooks/useMigration';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceType = 'xtreamui' | 'xuione' | 'xtream_api' | 'm3u';

interface XtreamForm {
  serverUrl: string;
  username: string;
  password: string;
  live: boolean;
  vod: boolean;
  series: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = [
  { label: 'Kaynak', description: 'Panel tipi' },
  { label: 'Bağlantı', description: 'Dosya/URL' },
  { label: 'Önizleme', description: 'İçeriği gözden geçir' },
  { label: 'Import', description: 'İçe aktar' },
];

const PAGE_TABS: TabItem[] = [
  { id: 'wizard', label: 'Yeni Import' },
  { id: 'history', label: 'İş Geçmişi' },
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-gray',
  RUNNING: 'badge-blue',
  COMPLETED: 'badge-success',
  FAILED: 'badge-danger',
  CANCELLED: 'badge-warning',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekliyor',
  RUNNING: 'Çalışıyor',
  COMPLETED: 'Tamamlandı',
  FAILED: 'Hata',
  CANCELLED: 'İptal',
};

// ─── Source card config ───────────────────────────────────────────────────────

const SOURCES: { id: SourceType; icon: React.ElementType; title: string; subtitle: string; tags: string[] }[] = [
  {
    id: 'xtreamui',
    icon: Database,
    title: 'XtreamUI',
    subtitle: 'MySQL dump (.sql)',
    tags: ['Kanallar', 'Kullanıcılar', 'Reseller\'lar', 'Paketler', 'Bouquet\'ler', 'EPG'],
  },
  {
    id: 'xuione',
    icon: Database,
    title: 'XUI.ONE',
    subtitle: 'MySQL dump (.sql)',
    tags: ['Kanallar', 'Kullanıcılar', 'Reseller\'lar', 'Paketler', 'Bouquet\'ler'],
  },
  {
    id: 'xtream_api',
    icon: Link2,
    title: 'Xtream API',
    subtitle: 'URL + kullanıcı adı + şifre',
    tags: ['Kanallar', 'VOD', 'Diziler', 'Kategoriler'],
  },
  {
    id: 'm3u',
    icon: FileText,
    title: 'M3U Dosyası',
    subtitle: '.m3u / .m3u8',
    tags: ['Kanallar', 'Kategoriler'],
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Kopyalandı' : 'Kopyala'}
    </button>
  );
}

interface PreviewStatProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  disabled?: boolean;
}

function PreviewStat({ icon: Icon, label, value, sub, disabled }: PreviewStatProps) {
  return (
    <div className={cn('card p-4 flex flex-col gap-2', disabled && 'opacity-40')}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-light" />
        </div>
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>
        {value.toLocaleString('tr-TR')}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: DumpImportOptions = {
  importStreams: true,
  importCategories: true,
  importUsers: true,
  importResellers: true,
  importPackages: true,
  importBouquets: true,
  importEpgMappings: false,
  conflictMode: 'SKIP',
  defaultPassword: '',
};

export function MigrationPage() {
  const [pageTab, setPageTab] = useState('wizard');
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<SourceType>('xtreamui');

  // Dump flow state
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [dumpJobId, setDumpJobId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DumpPreview | null>(null);
  const [importOptions, setImportOptions] = useState<DumpImportOptions>(DEFAULT_OPTIONS);

  // M3U flow state
  const [m3uFile, setM3uFile] = useState<File | null>(null);
  const [m3uJobId, setM3uJobId] = useState<string | null>(null);

  // Xtream API state
  const [xtreamForm, setXtreamForm] = useState<XtreamForm>({
    serverUrl: '', username: '', password: '', live: true, vod: true, series: false,
  });
  const [xtreamJobId, setXtreamJobId] = useState<string | null>(null);

  // Hooks
  const uploadDump = useUploadDump();
  const previewDump = usePreviewDump();
  const startDumpImport = useStartDumpImport();
  const importM3U = useImportM3U();
  const importXtream = useImportXtream();

  const { data: jobs = [], isLoading: jobsLoading } = useMigrationJobs();

  const activeJobId = dumpJobId ?? m3uJobId ?? xtreamJobId;
  const { data: activeJob } = useMigrationJob(activeJobId, !!activeJobId);

  const isDumpSource = source === 'xtreamui' || source === 'xuione';

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = async () => {
    if (step === 2 && isDumpSource && dumpFile) {
      // Upload dump
      const uploadRes = await uploadDump.mutateAsync(dumpFile);
      const jobId = uploadRes.data.data.jobId;
      setDumpJobId(jobId);
      // Preview
      const previewRes = await previewDump.mutateAsync(jobId);
      setPreview(previewRes.data.data);
    }

    if (step === 3) {
      if (isDumpSource && dumpJobId) {
        await startDumpImport.mutateAsync({ jobId: dumpJobId, options: importOptions });
      } else if (source === 'm3u' && m3uFile) {
        const res = await importM3U.mutateAsync({ file: m3uFile });
        setM3uJobId(res.data.data.jobId);
      } else if (source === 'xtream_api') {
        const res = await importXtream.mutateAsync({
          serverUrl: xtreamForm.serverUrl,
          username: xtreamForm.username,
          password: xtreamForm.password,
          importLive: xtreamForm.live,
          importVod: xtreamForm.vod,
          importSeries: xtreamForm.series,
        });
        setXtreamJobId(res.data.data.jobId);
      }
    }

    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const reset = () => {
    setStep(1);
    setDumpFile(null);
    setDumpJobId(null);
    setPreview(null);
    setImportOptions(DEFAULT_OPTIONS);
    setM3uFile(null);
    setM3uJobId(null);
    setXtreamJobId(null);
    setXtreamForm({ serverUrl: '', username: '', password: '', live: true, vod: true, series: false });
  };

  const isBusy =
    uploadDump.isPending ||
    previewDump.isPending ||
    startDumpImport.isPending ||
    importM3U.isPending ||
    importXtream.isPending;

  const canGoNext = (): boolean => {
    if (step === 2) {
      if (isDumpSource) return !!dumpFile;
      if (source === 'm3u') return !!m3uFile;
      if (source === 'xtream_api') return !!(xtreamForm.serverUrl && xtreamForm.username && xtreamForm.password);
    }
    return true;
  };

  const mysqldumpCmd = `mysqldump -u root -p xtream_iptvpro > backup.sql`;

  // ── Job table ───────────────────────────────────────────────────────────────

  const jobColumns: Column<MigrationJob>[] = [
    {
      key: 'source',
      header: 'Kaynak',
      render: (row) => {
        const icon = row.source === 'M3U' ? FileText : row.source === 'XTREAM_API' ? Link2 : Database;
        const Icon = icon;
        const labels: Record<string, string> = { XTREAMUI: 'XtreamUI', XUIONE: 'XUI.ONE', M3U: 'M3U', XTREAM_API: 'Xtream API' };
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-muted" />
            <span className="text-sm">{labels[row.source] ?? row.source}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) => <span className={cn('badge', STATUS_BADGE[row.status])}>{STATUS_LABEL[row.status]}</span>,
    },
    {
      key: 'progress',
      header: 'İlerleme',
      render: (row) => (
        <div className="w-32">
          <ProgressBar
            value={row.processedRecords}
            max={Math.max(row.totalRecords, 1)}
            showPercent={false}
            animate={row.status === 'RUNNING'}
          />
        </div>
      ),
    },
    {
      key: 'records',
      header: 'Kayıt',
      render: (row) => <span className="text-sm">{row.processedRecords.toLocaleString('tr-TR')} / {row.totalRecords.toLocaleString('tr-TR')}</span>,
    },
    {
      key: 'failedRecords',
      header: 'Hata',
      render: (row) =>
        row.failedRecords > 0 ? (
          <span className="text-xs text-danger">{row.failedRecords}</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Başlangıç',
      render: (row) =>
        new Date(row.createdAt).toLocaleDateString('tr-TR', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        }),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Tabs tabs={PAGE_TABS} active={pageTab} onChange={setPageTab} />

      {/* ── WIZARD TAB ───────────────────────────────────────────────────── */}
      {pageTab === 'wizard' && (
        <div className="card p-6 space-y-8 max-w-3xl">
          <Wizard steps={STEPS} current={step} />

          {/* ── Step 1: Source selection ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-medium mb-4" style={{ color: 'var(--color-fg)' }}>
                Kaynak panel tipi seçin
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SOURCES.map(({ id, icon: Icon, title, subtitle, tags }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSource(id)}
                    className={cn(
                      'flex flex-col gap-3 p-4 rounded-xl border-2 transition-all text-left',
                      source === id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', source === id ? 'bg-primary/20' : 'bg-surface-2')}>
                        <Icon className={cn('w-5 h-5', source === id ? 'text-primary-light' : 'text-muted')} />
                      </div>
                      {source === id && <CheckCircle className="w-4 h-4 text-primary-light" />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--color-fg)' }}>{title}</div>
                      <div className="text-xs text-muted">{subtitle}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted">{tag}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Connection/File ───────────────────────────────────── */}
          {step === 2 && isDumpSource && (
            <div className="space-y-4">
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-fg)' }}>
                {source === 'xtreamui' ? 'XtreamUI' : 'XUI.ONE'} MySQL Dump
              </div>

              {/* mysqldump command hint */}
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted font-medium">Dump komutunu kopyala</span>
                  <CopyButton text={mysqldumpCmd} />
                </div>
                <code className="text-xs font-mono" style={{ color: 'var(--color-fg)' }}>{mysqldumpCmd}</code>
              </div>

              <FileUpload
                accept=".sql,text/plain,application/sql"
                maxSizeMB={500}
                file={dumpFile}
                onFile={setDumpFile}
                onClear={() => setDumpFile(null)}
                sublabel="SQL dump dosyası, maks 500 MB"
              />
            </div>
          )}

          {step === 2 && source === 'xtream_api' && (
            <div className="space-y-4">
              <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-fg)' }}>Xtream API Bağlantısı</div>

              {/* User warning */}
              <div className="flex items-start gap-3 p-3 bg-warning/5 border border-warning/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted">
                  Xtream API üzerinden <strong className="text-warning">kullanıcı ve reseller bilgileri taşınamaz</strong>.
                  Yalnızca içerik (kanal, VOD, dizi) ve kategoriler import edilir.
                </p>
              </div>

              <div>
                <label className="label">Sunucu URL</label>
                <input
                  className="input"
                  value={xtreamForm.serverUrl}
                  onChange={(e) => setXtreamForm((p) => ({ ...p, serverUrl: e.target.value }))}
                  placeholder="http://panel.example.com:25461"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Kullanıcı Adı</label>
                  <input
                    className="input"
                    value={xtreamForm.username}
                    onChange={(e) => setXtreamForm((p) => ({ ...p, username: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Şifre</label>
                  <input
                    type="password"
                    className="input"
                    value={xtreamForm.password}
                    onChange={(e) => setXtreamForm((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label mb-2">İçerik seçimi</label>
                <div className="flex gap-5">
                  {[{ key: 'live', label: 'Canlı' }, { key: 'vod', label: 'VOD' }, { key: 'series', label: 'Dizi' }].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={xtreamForm[key as keyof typeof xtreamForm] as boolean}
                        onChange={(e) => setXtreamForm((p) => ({ ...p, [key]: e.target.checked }))}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && source === 'm3u' && (
            <div>
              <div className="text-sm font-medium mb-3" style={{ color: 'var(--color-fg)' }}>M3U Dosyası</div>
              <FileUpload
                accept=".m3u,.m3u8,text/plain"
                maxSizeMB={100}
                file={m3uFile}
                onFile={setM3uFile}
                onClear={() => setM3uFile(null)}
                sublabel="M3U veya M3U8 formatında, maks 100 MB"
              />
            </div>
          )}

          {/* ── Step 3: Preview + Options ─────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              {previewDump.isPending || uploadDump.isPending ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Dosya analiz ediliyor…</span>
                </div>
              ) : isDumpSource && preview ? (
                <>
                  {/* Panel type badge */}
                  <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
                        Dump başarıyla analiz edildi
                      </div>
                      <div className="text-xs text-muted">
                        Tespit edilen panel: <strong>{preview.source === 'XTREAMUI' ? 'XtreamUI' : preview.source === 'XUIONE' ? 'XUI.ONE' : 'Bilinmiyor'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    <PreviewStat icon={Tv} label="Kanal" value={preview.streams.total} />
                    <PreviewStat icon={Users} label="Kullanıcı" value={preview.users.total} />
                    <PreviewStat icon={Store} label="Reseller" value={preview.resellers.total} />
                    <PreviewStat icon={Package} label="Paket" value={preview.packages.total} />
                    <PreviewStat icon={BookMarked} label="Bouquet" value={preview.bouquets.total} />
                    <PreviewStat icon={Radio} label="EPG Eşleme" value={preview.epgMappings.total} />
                  </div>

                  {/* Import options */}
                  <div className="border border-border rounded-xl p-4 space-y-4">
                    <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>Neyi taşıyalım?</div>
                    <div className="space-y-2.5">
                      {[
                        { key: 'importStreams', label: `Kanallar (${preview.streams.total.toLocaleString('tr-TR')})`, always: true },
                        { key: 'importCategories', label: `Kategoriler (${preview.categories.total.toLocaleString('tr-TR')})`, always: true },
                        { key: 'importUsers', label: `Kullanıcılar (${preview.users.total.toLocaleString('tr-TR')})`, dumpOnly: true },
                        { key: 'importResellers', label: `Reseller'lar (${preview.resellers.total.toLocaleString('tr-TR')})`, dumpOnly: true },
                        { key: 'importPackages', label: `Paketler (${preview.packages.total.toLocaleString('tr-TR')})`, dumpOnly: true },
                        { key: 'importBouquets', label: `Bouquet'ler (${preview.bouquets.total.toLocaleString('tr-TR')})`, dumpOnly: true },
                        { key: 'importEpgMappings', label: `EPG Eşleşmeleri (${preview.epgMappings.total.toLocaleString('tr-TR')})`, dumpOnly: true },
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-primary w-4 h-4"
                            checked={importOptions[key as keyof DumpImportOptions] as boolean}
                            onChange={(e) => setImportOptions((o) => ({ ...o, [key]: e.target.checked }))}
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-border space-y-2">
                      <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>Çakışma modu</div>
                      {[
                        { value: 'SKIP', label: 'Atla', desc: 'Mevcut kayıtları koru, yeni olanları ekle' },
                        { value: 'MERGE', label: 'Birleştir', desc: 'Yeni ekle, eskiyi güncelleme' },
                        { value: 'OVERWRITE', label: 'Üzerine yaz', desc: 'Mevcut kayıtları güncelle' },
                      ].map(({ value, label, desc }) => (
                        <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="conflictMode"
                            className="accent-primary mt-0.5"
                            value={value}
                            checked={importOptions.conflictMode === value}
                            onChange={() => setImportOptions((o) => ({ ...o, conflictMode: value as DumpImportOptions['conflictMode'] }))}
                          />
                          <div>
                            <div className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{label}</div>
                            <div className="text-xs text-muted">{desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-border">
                      <label className="label">Varsayılan şifre <span className="text-muted font-normal">(şifre hash bulunamazsa)</span></label>
                      <input
                        type="password"
                        className="input"
                        placeholder="Boş bırakılırsa 'changeme' kullanılır"
                        value={importOptions.defaultPassword ?? ''}
                        onChange={(e) => setImportOptions((o) => ({ ...o, defaultPassword: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              ) : source === 'xtream_api' ? (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted">
                  Xtream API bağlantısı kurulacak ve içerik import edilecek. İlerlemeyi bir sonraki adımda takip edebilirsiniz.
                </div>
              ) : source === 'm3u' ? (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-muted">
                  M3U dosyası import edilecek. İlerlemeyi bir sonraki adımda takip edebilirsiniz.
                </div>
              ) : null}
            </div>
          )}

          {/* ── Step 4: Progress ──────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              {isBusy && !activeJob ? (
                <div className="flex items-center gap-3 text-muted py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Import başlatılıyor…</span>
                </div>
              ) : activeJob ? (
                <>
                  {/* Overall progress */}
                  <ProgressBar
                    label="Toplam İlerleme"
                    sublabel={`${activeJob.processedRecords.toLocaleString('tr-TR')} / ${activeJob.totalRecords.toLocaleString('tr-TR')} kayıt işlendi`}
                    value={activeJob.processedRecords}
                    max={Math.max(activeJob.totalRecords, 1)}
                    variant={activeJob.status === 'FAILED' ? 'danger' : activeJob.status === 'COMPLETED' ? 'success' : 'default'}
                    animate={activeJob.status === 'RUNNING'}
                  />

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn('badge', STATUS_BADGE[activeJob.status])}>
                      {STATUS_LABEL[activeJob.status]}
                    </span>
                    {activeJob.status === 'RUNNING' && (
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> İşleniyor…
                      </span>
                    )}
                    {activeJob.failedRecords > 0 && (
                      <span className="text-xs text-danger flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {activeJob.failedRecords} hata
                      </span>
                    )}
                  </div>

                  {/* Completed summary */}
                  {activeJob.status === 'COMPLETED' && (
                    <div className="p-4 bg-success/5 border border-success/20 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span className="text-sm font-medium text-success">Import tamamlandı</span>
                      </div>
                      <div className="text-xs text-muted">
                        {activeJob.processedRecords.toLocaleString('tr-TR')} kayıt başarıyla import edildi.
                        {activeJob.failedRecords > 0 && ` ${activeJob.failedRecords} kayıt atlandı.`}
                      </div>
                    </div>
                  )}

                  {activeJob.status === 'FAILED' && (
                    <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-danger" />
                        <span className="text-sm font-medium text-danger">Import başarısız</span>
                      </div>
                      <div className="text-xs text-muted">Lütfen log kayıtlarını kontrol edin.</div>
                    </div>
                  )}

                  {(activeJob.status === 'COMPLETED' || activeJob.status === 'FAILED') && (
                    <button className="btn-primary" onClick={reset}>Yeni Import</button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted text-sm">Import durumu bulunamadı</div>
              )}
            </div>
          )}

          {/* ── Navigation buttons ────────────────────────────────────────── */}
          {step < 4 && (
            <div className="flex justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1 || isBusy}
                className="btn btn-ghost disabled:opacity-40 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> Geri
              </button>
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={!canGoNext() || isBusy}
                className="btn btn-primary flex items-center gap-1.5"
              >
                {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === 2 && isDumpSource ? 'Analiz Et' : step === 3 ? 'Import Başlat' : 'Devam'}
                {!isBusy && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────── */}
      {pageTab === 'history' && (
        <div className="card overflow-hidden">
          <DataTable
            columns={jobColumns}
            data={jobs}
            isLoading={jobsLoading}
            emptyMessage="Henüz migration işi yok"
          />
        </div>
      )}
    </div>
  );
}
