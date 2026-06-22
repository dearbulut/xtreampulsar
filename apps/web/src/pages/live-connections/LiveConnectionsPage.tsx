import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Wifi, ToggleRight, ToggleLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useLiveConnections } from '@/hooks/useConnections';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Connection } from '@/types';
import { formatDuration, cn } from '@/lib/utils';

const TYPE_BADGE: Record<string, string> = {
  LIVE:   'bg-emerald-500/15 text-emerald-400',
  VOD:    'bg-blue-500/15 text-blue-400',
  SERIES: 'bg-purple-500/15 text-purple-400',
};

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}s ${m}d ${s}s`;
  if (m > 0) return `${m}d ${s}s`;
  return `${s}s`;
}

export function LiveConnectionsPage() {
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading, refetch, isFetching } = useLiveConnections(page, 50, autoRefresh);

  const kickUser = useMutation({
    mutationFn: (userId: string) => api.post(`/users/${userId}/kick`),
    onSuccess: () => { void refetch(); toast.success('Bağlantı kesildi'); },
    onError: () => toast.error('İşlem başarısız'),
  });

  const columns: Column<Connection>[] = [
    {
      key: 'status',
      header: '',
      className: 'w-8',
      render: () => (
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
      ),
    },
    {
      key: 'username',
      header: 'Kullanıcı',
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-slate-200 font-mono">{r.username}</div>
          <div className="text-xs text-muted">{r.ip}</div>
        </div>
      ),
    },
    {
      key: 'streamName',
      header: 'Stream',
      render: (r) => (
        <div>
          <div className="text-sm text-slate-300 truncate max-w-40" title={r.streamName}>
            {r.streamName}
          </div>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', TYPE_BADGE[r.streamType] ?? TYPE_BADGE.LIVE)}>
            {r.streamType}
          </span>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (r) => (
        <span className="text-xs font-mono text-slate-300">{r.ip}</span>
      ),
    },
    {
      key: 'userAgent',
      header: 'User Agent',
      render: (r) => (
        <span
          className="text-xs text-muted truncate max-w-36 block"
          title={r.userAgent}
        >
          {r.userAgent ? r.userAgent.slice(0, 32) + (r.userAgent.length > 32 ? '…' : '') : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Süre',
      render: (r) => (
        <span className="text-sm text-muted tabular-nums">
          {r.duration ? fmtDuration(r.duration) : formatDuration(r.startedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (r) => (
        <button
          onClick={() => kickUser.mutate(r.userId)}
          disabled={kickUser.isPending}
          className="flex items-center gap-1 text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
        >
          <Wifi className="w-3 h-3" />
          Kes
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Canlı Bağlantılar"
        description={`${data?.total ?? 0} aktif bağlantı`}
        actions={
          <>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn('btn-ghost flex items-center gap-1.5 text-xs', autoRefresh && 'text-emerald-400')}
            >
              {autoRefresh ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Auto-Refresh
            </button>
            <button
              onClick={() => void refetch()}
              disabled={isFetching}
              className="btn-ghost"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </>
        }
      />

      {autoRefresh && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 mb-4 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          3 saniyede bir otomatik yenileniyor
        </div>
      )}

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages}
          total={data?.total}
          onPageChange={setPage}
          emptyTitle="Aktif bağlantı yok"
          emptyDescription="Şu an herhangi bir kullanıcı bağlı değil."
        />
      </div>
    </div>
  );
}
