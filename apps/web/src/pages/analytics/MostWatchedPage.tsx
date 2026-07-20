import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Eye, Users, Clock, Tv, Film, Clapperboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMostWatched, type WatchRange, type WatchType, type MostWatchedItem } from '@/hooks/useMostWatched';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<MostWatchedItem['type'], typeof Tv> = { LIVE: Tv, VOD: Film, SERIES: Clapperboard };

function fmtDuration(mins: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (mins < 60) return t('mostWatched.minShort', { n: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}${t('mostWatched.hourShort')} ${m}${t('mostWatched.minShortBare')}` : `${h}${t('mostWatched.hourShort')}`;
}

export function MostWatchedPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<WatchRange>('7d');
  const [type, setType] = useState<WatchType>('all');
  const { data, isLoading } = useMostWatched(range, type);

  const items = data ?? [];
  const ranges: { key: WatchRange; label: string }[] = [
    { key: '24h', label: t('mostWatched.range24h') },
    { key: '7d', label: t('mostWatched.range7d') },
    { key: '30d', label: t('mostWatched.range30d') },
  ];
  const types: { key: WatchType; label: string }[] = [
    { key: 'all', label: t('mostWatched.typeAll') },
    { key: 'vod', label: t('mostWatched.typeVod') },
    { key: 'series', label: t('mostWatched.typeSeries') },
  ];
  const maxSessions = items.reduce((m, i) => Math.max(m, i.sessions), 0) || 1;

  return (
    <div>
      <PageHeader title={t('mostWatched.title')} description={t('mostWatched.subtitle')} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5">
          {types.map((f) => (
            <button key={f.key} onClick={() => setType(f.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm', type === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {ranges.map((f) => (
            <button key={f.key} onClick={() => setRange(f.key)}
              className={cn('px-3 py-1.5 rounded-lg text-sm', range === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Flame className="w-8 h-8 text-muted mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted">{t('mostWatched.empty')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it, idx) => {
              const Icon = TYPE_ICON[it.type] ?? Tv;
              return (
                <div key={it.streamId} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50">
                  <span className={cn('w-7 text-center font-bold tabular-nums', idx < 3 ? 'text-primary' : 'text-muted')}>{idx + 1}</span>
                  <div className="w-10 h-14 rounded bg-surface-2 overflow-hidden flex items-center justify-center shrink-0">
                    {it.poster ? (
                      <img src={it.poster} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Icon className="w-4 h-4 text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100 truncate">{it.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                      <Icon className="w-3 h-3" />
                      <span>{t(`mostWatched.type${it.type.charAt(0) + it.type.slice(1).toLowerCase()}`)}</span>
                      {it.category && <span className="truncate">· {it.category}</span>}
                    </div>
                    <div className="h-1 mt-1.5 bg-surface-2 rounded-full overflow-hidden max-w-xs">
                      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${Math.max(4, (it.sessions / maxSessions) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-sm shrink-0">
                    <div className="text-center" title={t('mostWatched.sessions')}>
                      <div className="flex items-center gap-1 text-slate-200"><Eye className="w-3.5 h-3.5 text-muted" />{it.sessions}</div>
                      <div className="text-[10px] text-muted uppercase tracking-wide">{t('mostWatched.sessionsShort')}</div>
                    </div>
                    <div className="text-center" title={t('mostWatched.uniqueViewers')}>
                      <div className="flex items-center gap-1 text-slate-200"><Users className="w-3.5 h-3.5 text-muted" />{it.uniqueViewers}</div>
                      <div className="text-[10px] text-muted uppercase tracking-wide">{t('mostWatched.viewersShort')}</div>
                    </div>
                    <div className="text-center min-w-[64px]" title={t('mostWatched.watchTime')}>
                      <div className="flex items-center gap-1 text-slate-200"><Clock className="w-3.5 h-3.5 text-muted" />{fmtDuration(it.watchMinutes, t)}</div>
                      <div className="text-[10px] text-muted uppercase tracking-wide">{t('mostWatched.watchShort')}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
