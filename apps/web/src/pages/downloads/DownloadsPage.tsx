import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download, Pause, Play, X, Trash2, Plus, FilmIcon, AlertCircle,
  HardDrive, RotateCcw, ArrowUp, Save, Clock,
} from 'lucide-react';
import {
  useDownloads, useCreateDownload, useBatchDownload, usePauseDownload, useResumeDownload,
  useCancelDownload, useAddDownloadToVod, useDeleteDownload, useBumpPriority,
  useDownloadConfig, useUpdateDownloadConfig, useDiskUsage, useRetryFailed, useClearFinished,
  type DownloadJob,
} from '@/hooks/useDownloads';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

function fmtBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
function fmtEta(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return h ? `${h}s ${m}dk` : m ? `${m}dk ${s}sn` : `${s}sn`;
}

const STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-slate-500/15 text-slate-300',
  DOWNLOADING: 'bg-info/15 text-info',
  PAUSED: 'bg-warning/15 text-warning',
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-danger/15 text-danger',
  CANCELED: 'bg-slate-500/15 text-muted',
};

function JobRow({ job }: { job: DownloadJob }) {
  const { t } = useTranslation();
  const pause = usePauseDownload();
  const resume = useResumeDownload();
  const cancel = useCancelDownload();
  const addVod = useAddDownloadToVod();
  const del = useDeleteDownload();
  const bump = useBumpPriority();

  const total = Number(job.totalBytes);
  const done = Number(job.downloadedBytes);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : job.status === 'COMPLETED' ? 100 : 0;
  const active = job.status === 'DOWNLOADING' || job.status === 'QUEUED';
  const eta = job.status === 'DOWNLOADING' && job.speedBps > 0 && total > done ? fmtEta((total - done) / job.speedBps) : '';

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm text-slate-200 truncate">{job.filename}</div>
          <div className="text-[11px] text-muted font-mono truncate" title={job.url}>{job.url}</div>
        </div>
        <span className={cn('shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLE[job.status])}>
          {t(`downloads.status.${job.status}`)}
        </span>
      </div>

      {(active || job.status === 'PAUSED') && (
        <div className="space-y-1">
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full bg-info rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted tabular-nums">
            <span>{fmtBytes(done)}{total > 0 && ` / ${fmtBytes(total)}`} ({pct}%)</span>
            <span className="flex items-center gap-2">
              {job.status === 'DOWNLOADING' && `${fmtBytes(job.speedBps)}/s · ${job.connections} bağ.`}
              {eta && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {eta}</span>}
            </span>
          </div>
        </div>
      )}

      {job.status === 'FAILED' && job.error && (
        <div className="flex items-center gap-1.5 text-[11px] text-danger"><AlertCircle className="w-3.5 h-3.5" />{job.error}</div>
      )}

      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
        {job.status === 'QUEUED' && (
          <button className="btn-ghost text-xs" onClick={() => bump.mutate(job.id)}><ArrowUp className="w-3.5 h-3.5" /> {t('downloads.priority')}</button>
        )}
        {job.status === 'DOWNLOADING' && (
          <button className="btn-ghost text-xs" onClick={() => pause.mutate(job.id)}><Pause className="w-3.5 h-3.5" /> {t('downloads.pause')}</button>
        )}
        {(job.status === 'PAUSED' || job.status === 'FAILED' || job.status === 'CANCELED') && (
          <button className="btn-ghost text-xs" onClick={() => resume.mutate(job.id)}><Play className="w-3.5 h-3.5" /> {t('downloads.resume')}</button>
        )}
        {active && (
          <button className="btn-ghost text-xs text-warning" onClick={() => cancel.mutate(job.id)}><X className="w-3.5 h-3.5" /> {t('downloads.cancel')}</button>
        )}
        {job.status === 'COMPLETED' && !job.createdStreamId && (
          <button className="btn-ghost text-xs text-success" disabled={!job.categoryId || addVod.isPending} onClick={() => addVod.mutate(job.id)}>
            <FilmIcon className="w-3.5 h-3.5" /> {job.categoryId ? t('downloads.addToVod') : t('downloads.noCategory')}
          </button>
        )}
        {job.status === 'COMPLETED' && job.createdStreamId && (
          <span className="text-[11px] text-success flex items-center gap-1"><FilmIcon className="w-3.5 h-3.5" /> {t('downloads.addedToVod')}</span>
        )}
        <button className="btn-ghost text-xs text-danger ml-auto" onClick={() => del.mutate(job.id)}><Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}</button>
      </div>
    </div>
  );
}

export function DownloadsPage() {
  const { t } = useTranslation();
  const { data: jobs = [] } = useDownloads();
  const { data: categories = [] } = useCategories('VOD');
  const { data: config } = useDownloadConfig();
  const { data: disk } = useDiskUsage();
  const create = useCreateDownload();
  const batch = useBatchDownload();
  const updateConfig = useUpdateDownloadConfig();
  const retryFailed = useRetryFailed();
  const clearFinished = useClearFinished();

  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [batchText, setBatchText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [connections, setConnections] = useState(16);
  const [autoVod, setAutoVod] = useState(false);

  // Config yerel durumu
  const [speed, setSpeed] = useState(0);
  const [concurrency, setConcurrency] = useState(3);
  const [cfgAutoVod, setCfgAutoVod] = useState(false);
  useEffect(() => {
    if (config) { setSpeed(config.downloadSpeedKbps); setConcurrency(config.downloadConcurrency); setCfgAutoVod(config.downloadAutoVod); }
  }, [config]);

  const dup = mode === 'single' && url.trim() && jobs.some((j) => j.url === url.trim());
  const failedCount = jobs.filter((j) => j.status === 'FAILED').length;
  const finishedCount = jobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELED').length;

  const submitSingle = () => {
    if (!url.trim()) return;
    create.mutate(
      { url: url.trim(), filename: filename.trim() || undefined, categoryId: categoryId || undefined, connections, autoVod },
      { onSuccess: () => { setUrl(''); setFilename(''); } },
    );
  };
  const submitBatch = () => {
    if (!batchText.trim()) return;
    batch.mutate(
      { text: batchText, categoryId: categoryId || undefined, connections, autoVod },
      { onSuccess: () => setBatchText('') },
    );
  };

  const diskPct = disk && disk.total > 0 ? Math.round(((disk.total - disk.free) / disk.total) * 100) : 0;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Download className="w-5 h-5" /> {t('downloads.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('downloads.subtitle')}</p>
      </div>

      {/* Config + Disk */}
      <div className="rounded-xl border border-border bg-surface p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide">{t('downloads.settings')}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">{t('downloads.speedLimit')}</label>
              <input type="number" min={0} className="input" value={speed} onChange={(e) => setSpeed(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            </div>
            <div>
              <label className="label text-xs">{t('downloads.concurrency')}</label>
              <input type="number" min={1} max={10} className="input" value={concurrency} onChange={(e) => setConcurrency(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" className="accent-indigo-500" checked={cfgAutoVod} onChange={(e) => setCfgAutoVod(e.target.checked)} />
            {t('downloads.defaultAutoVod')}
          </label>
          <button className="btn btn-ghost text-xs" disabled={updateConfig.isPending}
            onClick={() => updateConfig.mutate({ downloadSpeedKbps: speed, downloadConcurrency: concurrency, downloadAutoVod: cfgAutoVod })}>
            <Save className="w-3.5 h-3.5" /> {t('common.save')}
          </button>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> {t('downloads.disk')}</div>
          {disk && (
            <>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', diskPct > 90 ? 'bg-danger' : diskPct > 75 ? 'bg-warning' : 'bg-success')} style={{ width: `${diskPct}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-muted tabular-nums">
                <span>{t('downloads.mediaUsed')}: {fmtBytes(disk.used)}</span>
                <span>{t('downloads.free')}: {fmtBytes(disk.free)} / {fmtBytes(disk.total)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ekleme */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5 w-fit">
          {(['single', 'batch'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('px-3 py-1 rounded text-xs font-medium', mode === m ? 'bg-indigo-500 text-white' : 'text-muted')}>
              {t(m === 'single' ? 'downloads.single' : 'downloads.batch')}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <>
            <div>
              <label className="label">{t('downloads.url')} *</label>
              <input className="input font-mono text-xs" placeholder="https://.../film.mp4" value={url} onChange={(e) => setUrl(e.target.value)} />
              {dup && <p className="text-[11px] text-warning mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t('downloads.duplicate')}</p>}
            </div>
            <div>
              <label className="label">{t('downloads.filenameOptional')}</label>
              <input className="input" placeholder={t('downloads.filenameAuto')} value={filename} onChange={(e) => setFilename(e.target.value)} />
            </div>
          </>
        ) : (
          <div>
            <label className="label">{t('downloads.batchList')}</label>
            <textarea className="input font-mono text-xs" rows={6} placeholder={t('downloads.batchPlaceholder')} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
            <p className="text-[11px] text-muted mt-1">{t('downloads.batchHint')}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('downloads.connections')}</label>
            <select className="input" value={connections} onChange={(e) => setConnections(parseInt(e.target.value, 10))}>
              {[4, 8, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('downloads.targetCategory')}</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('downloads.noCategoryOption')}</option>
              {categories.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" className="accent-indigo-500" checked={autoVod} disabled={!categoryId} onChange={(e) => setAutoVod(e.target.checked)} />
          {t('downloads.autoVodJob')}
        </label>

        <div className="flex justify-end">
          {mode === 'single' ? (
            <button className="btn btn-primary" disabled={!url.trim() || create.isPending} onClick={submitSingle}>
              <Plus className="w-4 h-4" /> {t('downloads.startDownload')}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!batchText.trim() || batch.isPending} onClick={submitBatch}>
              <Plus className="w-4 h-4" /> {t('downloads.startBatch')}
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted border-t border-border/50 pt-2">{t('downloads.legalNote')}</p>
      </div>

      {/* Liste + araç çubuğu */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{jobs.length} {t('downloads.jobs')}</span>
        <div className="flex gap-2">
          {failedCount > 0 && (
            <button className="btn-ghost text-xs" onClick={() => retryFailed.mutate()}><RotateCcw className="w-3.5 h-3.5" /> {t('downloads.retryFailed')}</button>
          )}
          {finishedCount > 0 && (
            <button className="btn-ghost text-xs text-muted" onClick={() => clearFinished.mutate()}><Trash2 className="w-3.5 h-3.5" /> {t('downloads.clearFinished')}</button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">{t('downloads.empty')}</div>
        ) : jobs.map((j) => <JobRow key={j.id} job={j} />)}
      </div>
    </div>
  );
}
