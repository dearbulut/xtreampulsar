import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Pause, Play, X, Trash2, Plus, FilmIcon, AlertCircle } from 'lucide-react';
import {
  useDownloads, useCreateDownload, usePauseDownload, useResumeDownload,
  useCancelDownload, useAddDownloadToVod, useDeleteDownload, type DownloadJob,
} from '@/hooks/useDownloads';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

function fmtBytes(n: number): string {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
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

  const total = Number(job.totalBytes);
  const done = Number(job.downloadedBytes);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : job.status === 'COMPLETED' ? 100 : 0;
  const active = job.status === 'DOWNLOADING' || job.status === 'QUEUED';

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
            <span>{job.status === 'DOWNLOADING' ? `${fmtBytes(job.speedBps)}/s · ${job.connections} bağ.` : ''}</span>
          </div>
        </div>
      )}

      {job.status === 'FAILED' && job.error && (
        <div className="flex items-center gap-1.5 text-[11px] text-danger"><AlertCircle className="w-3.5 h-3.5" />{job.error}</div>
      )}

      <div className="flex items-center gap-1.5 pt-0.5">
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
  const create = useCreateDownload();

  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [connections, setConnections] = useState(16);

  const submit = () => {
    if (!url.trim()) return;
    create.mutate(
      { url: url.trim(), filename: filename.trim() || undefined, categoryId: categoryId || undefined, connections },
      { onSuccess: () => { setUrl(''); setFilename(''); } },
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2"><Download className="w-5 h-5" /> {t('downloads.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('downloads.subtitle')}</p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div>
          <label className="label">{t('downloads.url')} *</label>
          <input className="input font-mono text-xs" placeholder="https://.../film.mp4" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('downloads.filenameOptional')}</label>
            <input className="input" placeholder={t('downloads.filenameAuto')} value={filename} onChange={(e) => setFilename(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('downloads.connections')}</label>
            <select className="input" value={connections} onChange={(e) => setConnections(parseInt(e.target.value, 10))}>
              {[4, 8, 16, 24, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">{t('downloads.targetCategory')}</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('downloads.noCategoryOption')}</option>
              {categories.map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-[11px] text-muted mt-1">{t('downloads.categoryHint')}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={!url.trim() || create.isPending} onClick={submit}>
            <Plus className="w-4 h-4" /> {t('downloads.startDownload')}
          </button>
        </div>
        <p className="text-[11px] text-muted border-t border-border/50 pt-2">{t('downloads.legalNote')}</p>
      </div>

      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center text-muted py-10 text-sm">{t('downloads.empty')}</div>
        ) : jobs.map((j) => <JobRow key={j.id} job={j} />)}
      </div>
    </div>
  );
}
