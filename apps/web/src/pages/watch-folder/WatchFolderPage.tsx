import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderSearch, RefreshCw, Save, Film, Clapperboard, Loader2, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn, formatDate } from '@/lib/utils';
import { useBouquets } from '@/hooks/useBouquets';
import {
  useWatchConfig,
  useWatchImports,
  useUpdateWatchConfig,
  useScanWatchFolder,
} from '@/hooks/useWatchFolder';

export function WatchFolderPage() {
  const { t } = useTranslation();
  const { data: cfg, isLoading } = useWatchConfig();
  const { data: bouquets = [] } = useBouquets();
  const { data: imports = [] } = useWatchImports();
  const update = useUpdateWatchConfig();
  const scan = useScanWatchFolder();

  const [enabled, setEnabled] = useState(false);
  const [path, setPath] = useState('');
  const [bouquetId, setBouquetId] = useState('');
  const [intervalMins, setIntervalMins] = useState(5);

  useEffect(() => {
    if (!cfg) return;
    setEnabled(cfg.enabled);
    setPath(cfg.path ?? '');
    setBouquetId(cfg.bouquetId ?? '');
    setIntervalMins(cfg.intervalMins ?? 5);
  }, [cfg]);

  const save = () => update.mutate({ enabled, path: path.trim(), bouquetId: bouquetId || undefined, intervalMins });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('watchFolder.title')}
        description={t('watchFolder.subtitle')}
        actions={
          <button className="btn-ghost" disabled={scan.isPending} onClick={() => scan.mutate()}>
            <RefreshCw className={cn('w-4 h-4', scan.isPending && 'animate-spin')} /> {t('watchFolder.scanNow')}
          </button>
        }
      />

      {isLoading ? (
        <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="card p-5 space-y-4 max-w-2xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-primary w-4 h-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className="font-medium text-fg">{t('watchFolder.enable')}</span>
            </label>

            <div>
              <label className="label">{t('watchFolder.path')}</label>
              <input className="input font-mono text-sm" placeholder="/data/media" value={path} onChange={(e) => setPath(e.target.value)} />
              <p className="text-[11px] text-muted mt-1">{t('watchFolder.pathHint')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{t('watchFolder.bouquet')}</label>
                <select className="input" value={bouquetId} onChange={(e) => setBouquetId(e.target.value)}>
                  <option value="">Default</option>
                  {bouquets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t('watchFolder.interval')}</label>
                <input type="number" min={1} max={1440} className="input" value={intervalMins} onChange={(e) => setIntervalMins(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-amber-500 bg-amber-500/10 rounded-lg px-2 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{t('watchFolder.serveNote')}</span>
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" disabled={update.isPending} onClick={save}>
                <Save className="w-4 h-4" /> {update.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-medium text-fg">{t('watchFolder.imports')}</div>
            {imports.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted flex flex-col items-center gap-2">
                <FolderSearch className="w-8 h-8 opacity-40" />
                {t('watchFolder.noImports')}
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted text-left text-xs sticky top-0 bg-surface">
                    <tr>
                      <th className="px-4 py-2">{t('watchFolder.colTitle')}</th>
                      <th className="px-4 py-2">{t('watchFolder.colKind')}</th>
                      <th className="px-4 py-2">{t('watchFolder.colStatus')}</th>
                      <th className="px-4 py-2">{t('watchFolder.colWhen')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {imports.map((im) => (
                      <tr key={im.id}>
                        <td className="px-4 py-2 text-fg">
                          <div className="truncate max-w-[360px]">{im.title}{im.kind === 'EPISODE' && im.season != null ? ` · S${im.season}E${im.episode}` : ''}</div>
                          <div className="text-[10px] text-muted font-mono truncate max-w-[360px]">{im.path}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            {im.kind === 'EPISODE' ? <Clapperboard className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                            {im.kind === 'EPISODE' ? t('watchFolder.kindEpisode') : t('watchFolder.kindMovie')}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn('badge inline-flex items-center gap-1', im.status === 'OK' ? 'text-success bg-success/10' : 'text-danger bg-danger/10')}>
                            {im.status === 'OK' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {im.status}
                          </span>
                          {im.status !== 'OK' && im.message && <div className="text-[10px] text-danger truncate max-w-[220px]">{im.message}</div>}
                        </td>
                        <td className="px-4 py-2 text-muted whitespace-nowrap text-xs">{formatDate(im.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
