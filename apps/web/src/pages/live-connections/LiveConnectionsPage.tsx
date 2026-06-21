import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Wifi, ToggleLeft, Globe } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useLiveConnections } from '@/hooks/useConnections';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Connection } from '@/types';
import { formatDuration, formatBytes, cn } from '@/lib/utils';

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
        <span className="w-2 h-2 rounded-full bg-success animate-pulse-slow inline-block" />
      ),
    },
    {
      key: 'user',
      header: 'Kullanıcı',
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-slate-200 font-mono">{r.user?.username ?? r.userId}</div>
          <div className="text-xs text-muted">{r.ip}</div>
        </div>
      ),
    },
    {
      key: 'stream',
      header: 'Stream',
      render: (r) => (
        <div>
          <div className="text-sm text-slate-300 truncate max-w-40">{r.stream?.name ?? r.streamId}</div>
          {r.stream && <span className="badge bg-surface-2 text-muted text-[10px]">{r.stream.status}</span>}
        </div>
      ),
    },
    {
      key: 'server',
      header: 'Sunucu',
      render: (r) => (
        <span className="text-sm text-muted">{r.server?.name ?? r.server?.ip ?? '—'}</span>
      ),
    },
    {
      key: 'userAgent',
      header: 'User Agent',
      render: (r) => (
        <span className="text-xs text-muted truncate max-w-36 block" title={r.userAgent}>
          {r.userAgent ? r.userAgent.slice(0, 30) + (r.userAgent.length > 30 ? '…' : '') : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Süre',
      render: (r) => (
        <span className="text-sm text-muted tabular-nums">{formatDuration(r.startedAt)}</span>
      ),
    },
    {
      key: 'bandwidth',
      header: 'Bant Genişliği',
      render: (r) => (
        <div className="text-xs text-muted tabular-nums">
          <div>↓ {formatBytes(r.bytesIn)}</div>
          <div>↑ {formatBytes(r.bytesOut)}</div>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP / Ülke',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-muted" />
          <span className="text-xs font-mono text-slate-300">{r.ip}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (r) => (
        <button
          onClick={() => r.userId && kickUser.mutate(r.userId)}
          disabled={kickUser.isPending}
          className="flex items-center gap-1 text-xs text-danger hover:bg-danger/10 px-2 py-1 rounded-lg transition-colors"
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
              className={cn('btn-ghost flex items-center gap-1.5 text-sm', autoRefresh && 'text-success')}
            >
              <ToggleLeft className="w-4 h-4" />
              Auto {autoRefresh ? 'ON' : 'OFF'}
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
        <div className="flex items-center gap-2 text-xs text-success mb-4 px-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
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
