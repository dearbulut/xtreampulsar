import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Tv, Film, Clapperboard, AlertTriangle, Loader2, Filter, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { useBouquets } from '@/hooks/useBouquets';
import { useServers } from '@/hooks/useServers';
import {
  useBrowseProvider,
  useSyncProvider,
  type Provider,
  type BrowseTypeResult,
  type SyncPayload,
} from '@/hooks/useProviders';

type TypeKey = 'live' | 'vod' | 'series';

const TYPE_META: Record<TypeKey, { labelKey: string; icon: typeof Tv }> = {
  live: { labelKey: 'providers.mirror.typeLive', icon: Tv },
  vod: { labelKey: 'providers.mirror.typeVod', icon: Film },
  series: { labelKey: 'providers.mirror.typeSeries', icon: Clapperboard },
};

function CategoryPicker({
  data,
  selected,
  onToggle,
  onAll,
}: {
  data?: BrowseTypeResult;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAll: (ids: string[], on: boolean) => void;
}) {
  const { t } = useTranslation();
  if (!data) return <div className="text-xs text-muted px-2 py-3">{t('providers.mirror.loading')}</div>;
  if (data.error) return <div className="text-xs text-danger px-2 py-3">{t('providers.mirror.fetchFail', { error: data.error })}</div>;
  if (data.categories.length === 0) return <div className="text-xs text-muted px-2 py-3">{t('providers.mirror.noCategories')}</div>;
  const allIds = data.categories.map((c) => c.category_id);
  const allOn = allIds.every((id) => selected.has(id));
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 bg-surface-2 text-[11px]">
        <span className="text-muted">{t('providers.mirror.catSummary', { cats: data.categories.length, streams: data.total })}</span>
        <button className="text-primary hover:underline" onClick={() => onAll(allIds, !allOn)}>
          {allOn ? t('providers.mirror.none') : t('providers.mirror.all')}
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-border/50">
        {data.categories.map((c) => (
          <label key={c.category_id} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-surface-2 cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={selected.has(c.category_id)} onChange={() => onToggle(c.category_id)} />
            <span className="truncate flex-1 text-fg">{c.category_name}</span>
            <span className="tabular-nums text-muted">{c.count}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SyncProviderModal({ provider, open, onClose }: { provider: Provider | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: bouquets = [] } = useBouquets();
  const { data: servers = [] } = useServers();
  const browse = useBrowseProvider(provider?.id ?? null, open);
  const sync = useSyncProvider();

  const [bouquetId, setBouquetId] = useState('');
  const [serverId, setServerId] = useState('');
  const [outputExt, setOutputExt] = useState<'ts' | 'm3u8'>('ts');
  const [dropPolicy, setDropPolicy] = useState<'KEEP' | 'DISABLE' | 'DELETE'>('KEEP');
  const [skipRaw, setSkipRaw] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [intervalMin, setIntervalMin] = useState(720);
  const [types, setTypes] = useState<Record<TypeKey, boolean>>({ live: true, vod: false, series: false });
  const [sel, setSel] = useState<Record<TypeKey, Set<string>>>({ live: new Set(), vod: new Set(), series: new Set() });
  const initRef = useRef(false);

  useEffect(() => {
    if (!open || !provider) return;
    initRef.current = false;
    setBouquetId(provider.mirrorBouquetId ?? '');
    setServerId(provider.mirrorServerId ?? '');
    setOutputExt((provider.outputExt as 'ts' | 'm3u8') ?? 'ts');
    setDropPolicy((provider.dropPolicy as 'KEEP' | 'DISABLE' | 'DELETE') ?? 'KEEP');
    setSkipRaw((provider.skipKeywords ?? []).join('\n'));
    setAutoSync(provider.autoSync ?? false);
    setIntervalMin(provider.syncIntervalMinutes ?? 720);
    setTypes({ live: provider.importLive ?? true, vod: provider.importVod ?? false, series: provider.importSeries ?? false });
    setSel({ live: new Set(), vod: new Set(), series: new Set() });
  }, [open, provider]);

  useEffect(() => {
    if (!browse.data || initRef.current) return;
    initRef.current = true;
    setSel({
      live: new Set(browse.data.live.categories.map((c) => c.category_id)),
      vod: new Set(browse.data.vod.categories.map((c) => c.category_id)),
      series: new Set(browse.data.series.categories.map((c) => c.category_id)),
    });
  }, [browse.data]);

  const toggleCat = (type: TypeKey, id: string) =>
    setSel((prev) => {
      const next = new Set(prev[type]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, [type]: next };
    });
  const setAll = (type: TypeKey, ids: string[], on: boolean) =>
    setSel((prev) => ({ ...prev, [type]: on ? new Set(ids) : new Set() }));

  const catsFor = (type: TypeKey): BrowseTypeResult | undefined =>
    browse.data ? browse.data[type] : undefined;

  const buildIds = (type: TypeKey): string[] | undefined => {
    if (!types[type]) return undefined;
    const all = catsFor(type)?.categories.map((c) => c.category_id) ?? [];
    const chosen = sel[type];
    if (all.length === 0 || chosen.size === all.length) return undefined;
    return Array.from(chosen);
  };

  const totalSelected = useMemo(() => {
    let n = 0;
    (['live', 'vod', 'series'] as TypeKey[]).forEach((tk) => {
      if (!types[tk]) return;
      const cats = catsFor(tk)?.categories ?? [];
      n += cats.filter((c) => sel[tk].has(c.category_id)).reduce((a, c) => a + c.count, 0);
    });
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, sel, browse.data]);

  if (!provider) return null;

  const run = () => {
    const skipKeywords = skipRaw.split(/[\n,]/).map((k) => k.trim()).filter(Boolean);
    const payload: SyncPayload = {
      bouquetId: bouquetId || undefined,
      serverId: serverId || undefined,
      outputExt,
      dropPolicy,
      importLive: types.live,
      importVod: types.vod,
      importSeries: types.series,
      liveCategoryIds: buildIds('live'),
      vodCategoryIds: buildIds('vod'),
      seriesCategoryIds: buildIds('series'),
      skipKeywords,
      autoSync,
      syncIntervalMinutes: intervalMin,
    };
    sync.mutate({ id: provider.id, payload }, { onSuccess: () => onClose() });
  };

  const noType = !types.live && !types.vod && !types.series;

  return (
    <Modal open={open} onClose={onClose} title={t('providers.mirror.title', { name: provider.name })} size="xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-xs text-muted">{t('providers.mirror.intro')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('providers.mirror.targetBouquet')}</label>
            <select className="input" value={bouquetId} onChange={(e) => setBouquetId(e.target.value)}>
              <option value="">{t('providers.mirror.bouquetDefault')}</option>
              {bouquets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('providers.mirror.server')}</label>
            <select className="input" value={serverId} onChange={(e) => setServerId(e.target.value)}>
              <option value="">{t('providers.mirror.serverNone')}</option>
              {servers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t('providers.mirror.liveFormat')}</label>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              {(['ts', 'm3u8'] as const).map((f) => (
                <button key={f} className={cn('flex-1 py-1.5', outputExt === f ? 'bg-primary text-white' : 'bg-surface hover:bg-surface-2 text-muted')} onClick={() => setOutputExt(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t('providers.mirror.vanished')}</label>
            <select className="input" value={dropPolicy} onChange={(e) => setDropPolicy(e.target.value as typeof dropPolicy)}>
              <option value="KEEP">{t('providers.mirror.keep')}</option>
              <option value="DISABLE">{t('providers.mirror.disable')}</option>
              <option value="DELETE">{t('providers.mirror.delete')}</option>
            </select>
          </div>
        </div>
        {dropPolicy === 'DELETE' && (
          <div className="flex items-start gap-2 text-[11px] text-amber-500 bg-amber-500/10 rounded-lg px-2 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('providers.mirror.deleteWarn')}</span>
          </div>
        )}

        <div className="space-y-3">
          {(['live', 'vod', 'series'] as TypeKey[]).map((tk) => {
            const M = TYPE_META[tk];
            const Icon = M.icon;
            const td = catsFor(tk);
            return (
              <div key={tk} className="card p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-primary" checked={types[tk]} onChange={(e) => setTypes((p) => ({ ...p, [tk]: e.target.checked }))} />
                  <Icon className="w-4 h-4 text-muted" />
                  <span className="text-sm font-medium text-fg">{t(M.labelKey)}</span>
                  {td && !td.error && <span className="text-[11px] text-muted ml-auto tabular-nums">{t('providers.mirror.streams', { n: td.total })}</span>}
                </label>
                {types[tk] && (
                  browse.isLoading
                    ? <div className="text-xs text-muted px-1">{t('providers.mirror.fetchingCats')}</div>
                    : <CategoryPicker data={td} selected={sel[tk]} onToggle={(id) => toggleCat(tk, id)} onAll={(ids, on) => setAll(tk, ids, on)} />
                )}
              </div>
            );
          })}
        </div>

        <div className="card p-3 space-y-3">
          <div>
            <label className="label flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> {t('providers.mirror.skipTitle')}</label>
            <textarea
              className="input font-mono text-xs min-h-[64px]"
              placeholder={t('providers.mirror.skipPlaceholder')}
              value={skipRaw}
              onChange={(e) => setSkipRaw(e.target.value)}
            />
            <p className="text-[11px] text-muted mt-1">{t('providers.mirror.skipHint')}</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            <Clock className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium text-fg">{t('providers.mirror.autoSync')}</span>
          </label>
          {autoSync && (
            <div className="pl-6">
              <label className="label">{t('providers.mirror.interval')}</label>
              <select className="input" value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))}>
                <option value={60}>{t('providers.mirror.int60')}</option>
                <option value={180}>{t('providers.mirror.int180')}</option>
                <option value={360}>{t('providers.mirror.int360')}</option>
                <option value={720}>{t('providers.mirror.int720')}</option>
                <option value={1440}>{t('providers.mirror.int1440')}</option>
              </select>
              <p className="text-[11px] text-muted mt-1">{t('providers.mirror.autoHint')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 justify-between pt-3 mt-3 border-t border-border">
        <span className="text-xs text-muted tabular-nums">{t('providers.mirror.selectedStreams', { n: totalSelected.toLocaleString() })}</span>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={sync.isPending}>{t('providers.mirror.cancel')}</button>
          <button className="btn-primary" onClick={run} disabled={sync.isPending || noType || browse.isLoading}>
            {sync.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {sync.isPending ? t('providers.mirror.running') : t('providers.mirror.run')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
