import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Wifi, ToggleRight, ToggleLeft, Download, Upload, Users, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useLiveConnections, useKickConnection } from '@/hooks/useConnections';
import { useSocket } from '@/hooks/useSocket';
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

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function fmtRate(bytes: number, seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const bitsPerSec = (bytes * 8) / seconds;
  const u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let i = 0;
  let v = bitsPerSec;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function StatTile({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  );
}

export function LiveConnectionsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { connected } = useSocket();
  const { data, isLoading, refetch, isFetching } = useLiveConnections(page, 50, autoRefresh);
  const kickConnection = useKickConnection();

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
      header: t('liveConnections.colUser'),
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
      header: t('liveConnections.colDuration'),
      render: (r) => (
        <span className="text-sm text-muted tabular-nums">
          {r.duration ? fmtDuration(r.duration) : formatDuration(r.startedAt)}
        </span>
      ),
    },
    {
      key: 'traffic',
      header: t('liveConnections.colTraffic'),
      render: (r) => {
        const out = Number(r.bytesOut ?? 0);
        const inB = Number(r.bytesIn ?? 0);
        return (
          <div className="text-xs tabular-nums">
            <div className="flex items-center gap-1 text-emerald-400"><Download className="w-3 h-3" /> {fmtBytes(out)}</div>
            <div className="flex items-center gap-1 text-blue-400"><Upload className="w-3 h-3" /> {fmtBytes(inB)}</div>
          </div>
        );
      },
    },
    {
      key: 'rate',
      header: t('liveConnections.colRate'),
      render: (r) => (
        <span className="text-xs text-muted tabular-nums" title={t('liveConnections.avgRateHint')}>
          {fmtRate(Number(r.bytesOut ?? 0), r.duration ?? 0)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (r) => (
        <button
          onClick={() => kickConnection.mutate(r.id)}
          disabled={kickConnection.isPending && kickConnection.variables === r.id}
          className="flex items-center gap-1 text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          <Wifi className="w-3 h-3" />
          {t('liveConnections.kick')}
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('nav.liveConnections')}
        description={t('liveConnections.activeConnections', { count: data?.total ?? 0 })}
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

      <div className="flex items-center gap-3 mb-4 px-1">
        {autoRefresh && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('liveConnections.autoRefreshInfo')}
          </div>
        )}
        <div className={cn(
          'flex items-center gap-1.5 text-xs',
          connected ? 'text-emerald-400' : 'text-muted',
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500',
          )} />
          {connected ? t('liveConnections.wsConnected') : t('liveConnections.wsDisconnected')}
        </div>
      </div>

      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatTile icon={Activity} label={t('liveConnections.statActive')} value={String(data.summary.active)} color="bg-emerald-500/15 text-emerald-400" />
          <StatTile icon={Users} label={t('liveConnections.statUsers')} value={String(data.summary.activeUsers)} color="bg-indigo-500/15 text-indigo-400" />
          <StatTile icon={Download} label={t('liveConnections.statOut')} value={fmtBytes(Number(data.summary.totalBytesOut))} color="bg-emerald-500/15 text-emerald-400" />
          <StatTile icon={Upload} label={t('liveConnections.statIn')} value={fmtBytes(Number(data.summary.totalBytesIn))} color="bg-blue-500/15 text-blue-400" />
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
          emptyTitle={t('liveConnections.emptyTitle')}
          emptyDescription={t('liveConnections.emptyDescription')}
        />
      </div>
    </div>
  );
}
