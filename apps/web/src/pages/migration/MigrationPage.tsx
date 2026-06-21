import { useState } from 'react';
import { Upload, Link2, ArrowRight, ArrowLeft, CheckCircle, FileText, Loader2 } from 'lucide-react';
import { Wizard, type WizardStep } from '@/components/ui/Wizard';
import { FileUpload } from '@/components/ui/FileUpload';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { usePreviewM3U, useImportM3U, useImportXtream, useMigrationJobs, useMigrationJob, type MigrationJob } from '@/hooks/useMigration';
import { cn } from '@/lib/utils';

type ImportMode = 'm3u' | 'xtream';

const STEPS: WizardStep[] = [
  { label: 'Yöntem', description: 'Import tipi' },
  { label: 'Kaynak', description: 'Dosya/URL' },
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

export function MigrationPage() {
  const [pageTab, setPageTab] = useState('wizard');
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<ImportMode>('m3u');
  const [m3uFile, setM3uFile] = useState<File | null>(null);
  const [xtreamForm, setXtreamForm] = useState({ serverUrl: '', username: '', password: '', live: true, vod: true, series: false });
  const [previewData, setPreviewData] = useState<{ total: number; entries: { name: string; url: string; groupTitle: string }[] } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const previewM3U = usePreviewM3U();
  const importM3U = useImportM3U();
  const importXtream = useImportXtream();
  const { data: jobs = [], isLoading: jobsLoading } = useMigrationJobs();
  const { data: activeJob } = useMigrationJob(jobId, !!jobId);

  const goNext = async () => {
    if (step === 2) {
      if (mode === 'm3u' && m3uFile) {
        const res = await previewM3U.mutateAsync(m3uFile);
        setPreviewData(res.data.data);
      }
    }
    if (step === 3) {
      if (mode === 'm3u' && m3uFile) {
        const res = await importM3U.mutateAsync({ file: m3uFile });
        setJobId(res.data.data.jobId);
      } else if (mode === 'xtream') {
        const res = await importXtream.mutateAsync({
          serverUrl: xtreamForm.serverUrl,
          username: xtreamForm.username,
          password: xtreamForm.password,
          importLive: xtreamForm.live,
          importVod: xtreamForm.vod,
          importSeries: xtreamForm.series,
        });
        setJobId(res.data.data.jobId);
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const reset = () => {
    setStep(1);
    setM3uFile(null);
    setPreviewData(null);
    setJobId(null);
    setXtreamForm({ serverUrl: '', username: '', password: '', live: true, vod: true, series: false });
  };

  const pct = activeJob ? Math.round((activeJob.processedRecords / Math.max(activeJob.totalRecords, 1)) * 100) : 0;
  const isImporting = importM3U.isPending || importXtream.isPending || previewM3U.isPending;

  const jobColumns: Column<MigrationJob>[] = [
    {
      key: 'source',
      header: 'Kaynak',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.source === 'M3U' ? <FileText className="w-3.5 h-3.5 text-muted" /> : <Link2 className="w-3.5 h-3.5 text-muted" />}
          <span className="text-sm">{row.source}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) => (
        <span className={cn('badge', STATUS_BADGE[row.status])}>{STATUS_LABEL[row.status]}</span>
      ),
    },
    {
      key: 'progress',
      header: 'İlerleme',
      render: (row) => (
        <div className="w-32">
          <ProgressBar
            value={row.processedRecords}
            max={row.totalRecords}
            showPercent={false}
            animate={row.status === 'RUNNING'}
          />
        </div>
      ),
    },
    {
      key: 'records',
      header: 'Kayıt',
      render: (row) => (
        <span className="text-sm">{row.processedRecords}/{row.totalRecords}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Başlangıç',
      render: (row) =>
        new Date(row.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Migration</h1>
        <p className="text-sm text-muted mt-0.5">M3U dosyaları veya Xtream API'sından içerik aktar</p>
      </div>

      <Tabs tabs={PAGE_TABS} active={pageTab} onChange={setPageTab} />

      {pageTab === 'wizard' && (
        <div className="card p-6 space-y-8 max-w-3xl">
          <Wizard steps={STEPS} current={step} />

          {/* Step 1: Mode */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-300 mb-4">Import yöntemi seçin</div>
              {[
                { id: 'm3u' as ImportMode, icon: Upload, label: 'M3U Dosyası', desc: '.m3u/.m3u8 dosyası yükle' },
                { id: 'xtream' as ImportMode, icon: Link2, label: 'Xtream API', desc: 'Sunucu URL + kullanıcı adı + şifre' },
              ].map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                    mode === id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', mode === id ? 'bg-primary/20' : 'bg-surface-2')}>
                    <Icon className={cn('w-5 h-5', mode === id ? 'text-primary-light' : 'text-muted')} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">{label}</div>
                    <div className="text-xs text-muted">{desc}</div>
                  </div>
                  {mode === id && <CheckCircle className="w-5 h-5 text-primary-light ml-auto" />}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Source */}
          {step === 2 && mode === 'm3u' && (
            <div>
              <div className="text-sm font-medium text-slate-300 mb-3">M3U Dosyası</div>
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

          {step === 2 && mode === 'xtream' && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-slate-300 mb-1">Xtream Kodları Bağlantısı</div>
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
                  <input className="input" value={xtreamForm.username} onChange={(e) => setXtreamForm((p) => ({ ...p, username: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Şifre</label>
                  <input type="password" className="input" value={xtreamForm.password} onChange={(e) => setXtreamForm((p) => ({ ...p, password: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-4">
                {[
                  { key: 'live', label: 'Canlı' },
                  { key: 'vod', label: 'VOD' },
                  { key: 'series', label: 'Dizi' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={xtreamForm[key as keyof typeof xtreamForm] as boolean}
                      onChange={(e) => setXtreamForm((p) => ({ ...p, [key]: e.target.checked }))}
                    />
                    <span className="text-sm text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div>
              {previewM3U.isPending ? (
                <div className="flex items-center justify-center py-12 gap-3 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>İçerik analiz ediliyor…</span>
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-success/5 border border-success/20 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <div className="text-sm font-medium text-slate-200">Dosya geçerli</div>
                      <div className="text-xs text-muted">{previewData.total} akış bulundu</div>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="border-b border-border">
                          <th className="text-left p-2.5 text-muted">Ad</th>
                          <th className="text-left p-2.5 text-muted">Grup</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.entries.slice(0, 50).map((e, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
                            <td className="p-2.5 text-slate-300 truncate max-w-[200px]">{e.name}</td>
                            <td className="p-2.5 text-muted truncate max-w-[120px]">{e.groupTitle || '-'}</td>
                          </tr>
                        ))}
                        {previewData.entries.length > 50 && (
                          <tr>
                            <td colSpan={2} className="p-2.5 text-center text-muted">
                              …ve {previewData.entries.length - 50} tane daha
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : mode === 'xtream' ? (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-slate-300">
                  Xtream API bağlantısı kurulacak ve içerik import edilecek. İlerlemeyi bir sonraki adımda takip edebilirsiniz.
                </div>
              ) : null}
            </div>
          )}

          {/* Step 4: Running */}
          {step === 4 && (
            <div className="space-y-5">
              {activeJob ? (
                <>
                  <ProgressBar
                    label="Import İlerlemesi"
                    sublabel={`${activeJob.processedRecords} / ${activeJob.totalRecords} kayıt işlendi`}
                    value={activeJob.processedRecords}
                    max={activeJob.totalRecords}
                    variant={activeJob.status === 'FAILED' ? 'danger' : activeJob.status === 'COMPLETED' ? 'success' : 'default'}
                    animate={activeJob.status === 'RUNNING'}
                  />
                  <div className="flex items-center gap-2">
                    <span className={cn('badge', STATUS_BADGE[activeJob.status])}>{STATUS_LABEL[activeJob.status]}</span>
                    {activeJob.failedRecords > 0 && (
                      <span className="text-xs text-danger">{activeJob.failedRecords} hata</span>
                    )}
                  </div>
                  {activeJob.status === 'COMPLETED' && (
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={reset}>Yeni Import</button>
                    </div>
                  )}
                </>
              ) : isImporting ? (
                <div className="flex items-center gap-3 text-muted py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Import başlatılıyor…</span>
                </div>
              ) : (
                <div className="text-center py-8 text-muted text-sm">Import başlatılamadı</div>
              )}
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="btn btn-ghost disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" /> Geri
              </button>
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={
                  (step === 2 && mode === 'm3u' && !m3uFile) ||
                  (step === 2 && mode === 'xtream' && (!xtreamForm.serverUrl || !xtreamForm.username)) ||
                  isImporting
                }
                className="btn btn-primary"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {step === 3 ? 'Import Et' : 'Devam'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {pageTab === 'history' && (
        <DataTable
          columns={jobColumns}
          data={jobs}
          isLoading={jobsLoading}
          emptyMessage="Henüz migration işi yok"
        />
      )}
    </div>
  );
}
