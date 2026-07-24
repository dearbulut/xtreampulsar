import { useState } from 'react';
import type { TFunction } from 'i18next';
import {
  Users,
  Tv,
  Activity,
  Database,
  UserPlus,
  Link2,
  UserX,
  ShieldCheck,
  Clock,
  LogIn,
  Play,
  Wifi,
  WifiOff,
  Server as ServerIcon,
  MessageSquareWarning,
  TvMinimal,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { StatCard } from '@/components/ui/StatCard';
import { GeoConnectionsCard } from '@/components/dashboard/GeoConnectionsCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  useDashboard,
  useDashboardStats,
  useConnectionsChart,
  useRecentActivity,
  useTopStreams,
  useServerStats,
} from '@/hooks/useDashboard';
import { useClientRequestStats } from '@/hooks/useClientRequests';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, t: TFunction): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return t('layout.justNow');
  if (m < 60) return t('layout.minutesAgo', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('layout.hoursAgo', { n: h });
  return t('layout.daysAgo', { n: Math.floor(h / 24) });
}

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function fmtMbps(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)} Gbps`;
  return `${v} Mbps`;
}

const ACTIVITY_ICON: Record<string, typeof LogIn> = {
  LOGIN: LogIn,
  LOGOUT: WifiOff,
  STREAM_START: Play,
  STREAM_END: Wifi,
};

const HEALTH_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];

const PERIODS: { label: string; value: 24 | 48 | 168 }[] = [
  { label: 'dashboard.period24h', value: 24 },
  { label: 'dashboard.period48h', value: 48 },
  { label: 'dashboard.period7d', value: 168 },
];

// ─── Main ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const [chartHours, setChartHours] = useState<24 | 48 | 168>(24);

  const { connected } = useSocket();
  const { data: live } = useDashboard();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: chartData = [], isLoading: chartLoading } = useConnectionsChart(chartHours);
  const { data: topStreams = [], isLoading: streamsLoading } = useTopStreams(10);
  const { data: activity = [], isLoading: activityLoading } = useRecentActivity(20);
  const { data: servers = [] } = useServerStats();
  const { data: reqStats } = useClientRequestStats();

  // Top 4 live cards — prefer WebSocket-pushed data, fall back to polled stats
  const activeConns = live?.connections?.active ?? stats?.activeConnections ?? 0;
  const activeStreams = live?.activeStreams ?? stats?.activeStreams ?? 0;
  const bandwidthMbps = live?.bandwidthMbps ?? stats?.bandwidthMbps ?? 0;
  const totalUsers = live?.users?.total ?? stats?.totalUsers ?? 0;

  const healthPie = [
    { name: t('dashboard.running'), value: stats?.streamsUp ?? 0 },
    { name: t('dashboard.down'), value: stats?.streamsDown ?? 0 },
    { name: t('dashboard.slow'), value: stats?.streamsDegraded ?? 0 },
  ].filter((d) => d.value > 0);

  const maxViewers = Math.max(...topStreams.map((s) => s.connections ?? 0), 1);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <div className={cn('flex items-center gap-2 text-sm', connected ? 'text-success' : 'text-danger')}>
          <span className={cn('w-2 h-2 rounded-full', connected ? 'bg-success animate-pulse' : 'bg-danger')} />
          {connected ? t('dashboard.liveBadge') : t('dashboard.disconnected')}
        </div>
      </div>

      {/* Row 1 — Big live stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={t('dashboard.activeConnections')}
          value={activeConns.toLocaleString('tr')}
          icon={Users}
          variant="success"
          live={connected}
          subtitle={t('dashboard.last30s')}
        />
        <StatCard
          title={t('dashboard.liveStream')}
          value={activeStreams.toLocaleString('tr')}
          icon={Tv}
          variant="info"
          live={connected}
          subtitle={t('dashboard.watchingNow')}
        />
        <StatCard
          title={t('dashboard.instantBandwidth')}
          value={fmtMbps(bandwidthMbps)}
          icon={Activity}
          variant="primary"
          live={connected}
          subtitle={t('dashboard.thisHourEstimate')}
        />
        <StatCard
          title={t('dashboard.totalUsers')}
          value={totalUsers.toLocaleString('tr')}
          icon={Database}
          variant="default"
          subtitle={stats ? t('dashboard.paidTrialSplit', { paid: stats.paidUsers.toLocaleString('tr'), trial: stats.trialUsers.toLocaleString('tr') }) : undefined}
        />
      </div>

      {/* Compact secondary metrics — tek ferah şerit */}
      <div className="card p-0 overflow-hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-border">
        {[
          { icon: UserPlus, label: t('dashboard.newUsersToday'), value: stats?.newUsersToday ?? '—', color: 'text-success' },
          { icon: Link2, label: t('dashboard.connectionsTodayShort'), value: stats?.connectionsToday != null ? stats.connectionsToday.toLocaleString('tr') : '—', color: 'text-info' },
          { icon: UserX, label: t('dashboard.expiredUsers'), value: stats?.expiredUsers != null ? stats.expiredUsers.toLocaleString('tr') : '—', color: 'text-warning' },
          { icon: ShieldCheck, label: t('dashboard.streamHealth'), value: stats ? `${stats.streamsUp}/${stats.totalStreams}` : '—', color: stats && stats.streamsDown > 0 ? 'text-danger' : 'text-success' },
        ].map((m) => (
          <div key={m.label} className="p-4 flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs text-muted"><m.icon className="w-3.5 h-3.5" />{m.label}</span>
            <span className={cn('text-xl font-bold tabular-nums', m.color)}>{m.value}</span>
          </div>
        ))}
        <Link to="/client-requests" className="p-4 flex flex-col gap-1.5 hover:bg-surface-2 transition-colors">
          <span className="flex items-center gap-1.5 text-xs text-muted"><MessageSquareWarning className="w-3.5 h-3.5" />{t('dashboard.reportedChannels')}</span>
          <span className="text-xl font-bold tabular-nums text-fg">{reqStats?.openReports ?? '—'}</span>
        </Link>
        <Link to="/client-requests" className="p-4 flex flex-col gap-1.5 hover:bg-surface-2 transition-colors">
          <span className="flex items-center gap-1.5 text-xs text-muted"><TvMinimal className="w-3.5 h-3.5" />{t('dashboard.channelRequests')}</span>
          <span className="text-xl font-bold tabular-nums text-fg">{reqStats?.openRequests ?? '—'}</span>
        </Link>
      </div>

      {/* Row 2.5 — Per-server live cards */}
      {servers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-fg mb-2">{t('dashboard.servers')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map((sv) => (
              <div key={sv.id} className="card card-hover p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <ServerIcon className="w-4 h-4 text-muted shrink-0" />
                    <span className="font-medium text-fg truncate">{sv.name}</span>
                  </div>
                  <span className={cn('flex items-center gap-1 text-xs', sv.isOnline ? 'text-success' : 'text-danger')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', sv.isOnline ? 'bg-success animate-pulse-slow' : 'bg-danger')} />
                    {sv.isOnline ? t('dashboard.online') : t('dashboard.offline')}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span className="tabular-nums">{(sv.activeConnections ?? 0).toLocaleString('tr')} / {sv.maxClients.toLocaleString('tr')}</span>
                    <span className="tabular-nums">{Math.round(sv.utilization ?? 0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', (sv.utilization ?? 0) >= 90 ? 'bg-danger' : (sv.utilization ?? 0) >= 70 ? 'bg-warning' : 'bg-primary')}
                      style={{ width: `${Math.min(100, sv.utilization ?? 0)}%` }}
                    />
                  </div>
                </div>
                {sv.responseTime != null && (
                  <p className="text-xs text-muted mt-2">{t('dashboard.responseMs', { n: sv.responseTime })}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 3 — Connection chart + Health pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Chart (2/3) */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-fg">{t('dashboard.connectionChart')}</h2>
              <p className="text-xs text-muted mt-0.5">{t('dashboard.hourlyConnBandwidth')}</p>
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setChartHours(p.value)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-lg transition-colors',
                    chartHours === p.value
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {t(p.label)}
                </button>
              ))}
            </div>
          </div>

          {chartLoading ? (
            <div className="h-52 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="connGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={fmtHour}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  interval={chartHours <= 24 ? 3 : chartHours <= 48 ? 6 : 23}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}MB`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--fg)' }}
                  labelFormatter={(v: string) => fmtHour(v)}
                  formatter={(val: number, name: string) =>
                    name === 'connections'
                      ? [t('dashboard.nConnections', { n: val }), t('dashboard.connections')]
                      : [`${val} MB`, t('dashboard.bandwidth')]
                  }
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="connections"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#connGrad)"
                  dot={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="bandwidth"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#bwGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sağ sütun: ülke dağılımı + stream health */}
        <div className="space-y-4">
        <GeoConnectionsCard />
        <div className="card p-5">
          <h2 className="font-semibold text-fg mb-1">{t('dashboard.streamHealth')}</h2>
          <p className="text-xs text-muted mb-4">{t('dashboard.instantStatusDistribution')}</p>

          {statsLoading ? (
            <div className="h-52 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : healthPie.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted text-sm">
              <ShieldCheck className="w-8 h-8 text-success opacity-60" />
              <span>{t('dashboard.allStreamsNormal')}</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={healthPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {healthPie.map((_, i) => (
                      <Cell key={i} fill={HEALTH_COLORS[i % HEALTH_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v: string) => <span className="text-xs text-muted">{v}</span>}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                    formatter={(val: number) => [t('dashboard.nStreams', { n: val }), '']}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-3 space-y-2">
                {[
                  { label: t('dashboard.running'), value: stats?.streamsUp ?? 0, color: 'text-success' },
                  { label: t('dashboard.down'), value: stats?.streamsDown ?? 0, color: 'text-danger' },
                  { label: t('dashboard.slow'), value: stats?.streamsDegraded ?? 0, color: 'text-warning' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-muted">{row.label}</span>
                    <span className={cn('font-semibold tabular-nums', row.color)}>{row.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Row 4 — Top streams + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top streams */}
        <div className="card p-5 flex flex-col max-h-[480px]">
          <h2 className="font-semibold text-fg mb-1">{t('dashboard.topStreams')}</h2>
          <p className="text-xs text-muted mb-4">{t('dashboard.last24hByConnections')}</p>

          {streamsLoading ? (
            <div className="h-40 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : topStreams.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">{t('dashboard.noData')}</div>
          ) : (
            <div className="overflow-y-auto space-y-3 pr-1">
              {topStreams.map((entry, i) => {
                const name = entry.stream?.name ?? '—';
                const viewers = entry.connections ?? 0;
                const pct = Math.round((viewers / maxViewers) * 100);
                return (
                  <div key={entry.stream?.id ?? i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted tabular-nums w-4 shrink-0">{i + 1}</span>
                        <span className="text-sm text-fg truncate">{name}</span>
                        {entry.stream?.category?.name && (
                          <span className="text-xs text-muted shrink-0">
                            {entry.stream.category.name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-primary ml-2 shrink-0 tabular-nums">
                        {viewers.toLocaleString('tr')}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5 flex flex-col max-h-[480px]">
          <h2 className="font-semibold text-fg mb-1">{t('dashboard.recentActivity')}</h2>
          <p className="text-xs text-muted mb-4">{t('dashboard.userActionHistory')}</p>

          {activityLoading ? (
            <div className="h-40 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : activity.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">{t('dashboard.noActivity')}</div>
          ) : (
            <div className="overflow-y-auto space-y-1 pr-1">
              {activity.map((entry) => {
                const Icon = ACTIVITY_ICON[entry.type] ?? Clock;
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg truncate">{t(`activityLog.${entry.type}`, { defaultValue: entry.description })}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="font-medium">{entry.user}</span>
                        {' · '}
                        {timeAgo(entry.createdAt, t)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small info card ──────────────────────────────────────────────────────
