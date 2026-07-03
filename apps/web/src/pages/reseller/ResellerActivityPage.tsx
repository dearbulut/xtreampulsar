import { useState } from 'react';
import { Download, Clock, Users, TrendingUp, Search } from 'lucide-react';
import { useResellerActivity } from '@/hooks/useResellerPanel';
import { cn } from '@/lib/utils';

type RangeKey = 'week' | 'month' | 'custom';

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    LOGIN: 'bg-blue-500/15 text-blue-400',
    LOGOUT: 'bg-slate-500/15 text-slate-400',
    STREAM_START: 'bg-emerald-500/15 text-emerald-400',
    STREAM_STOP: 'bg-orange-500/15 text-orange-400',
    CONNECT: 'bg-emerald-500/15 text-emerald-400',
    DISCONNECT: 'bg-orange-500/15 text-orange-400',
  };
  const cls = map[action.toUpperCase()] ?? 'bg-surface-2 text-muted';
  return (
    <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded uppercase', cls)}>
      {action}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center">
        <Icon className="w-4 h-4 text-muted" />
      </div>
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-xl font-bold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ResellerActivityPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [page, setPage] = useState(1);

  const now = new Date();
  const startDate = rangeKey === 'week' ? toDateStr(new Date(now.getTime() - 7 * 86_400_000))
    : rangeKey === 'month' ? toDateStr(new Date(now.getTime() - 30 * 86_400_000))
    : customStart;
  const endDate = rangeKey === 'custom' ? customEnd : toDateStr(now);

  const { data, isLoading } = useResellerActivity({ startDate, endDate, page, limit: 50 });

  const items = data?.items ?? [];
  const summary = data?.summary;
  const totalPages = data?.totalPages ?? 1;

  const handleExport = () => {
    if (!items.length) return;
    const header = 'Tarih,Kullanıcı,Aksiyon,IP,Ülke,Süre(sn)';
    const rows = items.map((i) =>
      [i.createdAt, i.user?.username ?? '', i.action, i.ip ?? '', i.country ?? '', i.duration ?? ''].join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aktivite-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Aktivite</h1>
          <p className="text-sm text-muted">Kullanıcı oturum ve izleme geçmişi</p>
        </div>
        <button onClick={handleExport} disabled={!items.length} className="btn-secondary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          CSV İndir
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Toplam Oturum" value={summary?.totalSessions ?? 0} icon={TrendingUp} />
        <SummaryCard label="Toplam İzleme" value={`${summary?.totalWatchMinutes ?? 0} dk`} icon={Clock} />
        <SummaryCard label="En Aktif Kullanıcı" value={summary?.mostActiveUser ?? '—'} icon={Users} />
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(['week', 'month', 'custom'] as RangeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => { setRangeKey(k); setPage(1); }}
              className={cn('text-xs px-3 py-1.5 rounded-lg border transition-colors', rangeKey === k
                ? 'bg-primary/20 border-primary text-primary'
                : 'border-border text-muted hover:text-fg hover:border-border/80')}
            >
              {k === 'week' ? 'Bu Hafta' : k === 'month' ? 'Bu Ay' : 'Özel'}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input text-sm h-8 w-36" />
            <span className="text-muted text-xs">—</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input text-sm h-8 w-36" />
          </div>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            className="input pl-8 h-8 text-sm w-44"
            placeholder="Kullanıcı ara…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center text-muted">
            <Clock className="w-8 h-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm">Bu dönemde aktivite kaydı bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Tarih</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Kullanıcı</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Aksiyon</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">IP</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Ülke</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Süre</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((i) => !userSearch || i.user?.username.toLowerCase().includes(userSearch.toLowerCase()))
                  .map((i) => (
                    <tr key={i.id} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                        {new Date(i.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-slate-300">{i.user?.username ?? '—'}</td>
                      <td className="px-4 py-2.5"><ActionBadge action={i.action} /></td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{i.ip ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">{i.country ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {i.duration != null ? `${Math.round(i.duration / 60)}dk` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn-ghost p-1.5 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-muted">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn-ghost p-1.5 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
