import { useState } from 'react';
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
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  useDashboard,
  useDashboardStats,
  useConnectionsChart,
  useRecentActivity,
  useTopStreams,
} from '@/hooks/useDashboard';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
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
  { label: '24s', value: 24 },
  { label: '48s', value: 48 },
  { label: '7g', value: 168 },
];

// ─── Main ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const [chartHours, setChartHours] = useState<24 | 48 | 168>(24);

  const { connected } = useSocket();
  const { data: live } = useDashboard();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: chartData = [], isLoading: chartLoading } = useConnectionsChart(chartHours);
  const { data: topStreams = [], isLoading: streamsLoading } = useTopStreams(10);
  const { data: activity = [], isLoading: activityLoading } = useRecentActivity(20);

  // Top 4 live cards — prefer WebSocket-pushed data, fall back to polled stats
  const activeConns = live?.connections?.active ?? stats?.activeConnections ?? 0;
  const activeStreams = live?.activeStreams ?? stats?.activeStreams ?? 0;
  const bandwidthMbps = live?.bandwidthMbps ?? stats?.bandwidthMbps ?? 0;
  const totalUsers = live?.users?.total ?? stats?.totalUsers ?? 0;

  const healthPie = [
    { name: 'Çalışıyor', value: stats?.streamsUp ?? 0 },
    { name: 'Çökmüş', value: stats?.streamsDown ?? 0 },
    { name: 'Yavaş', value: stats?.streamsDegraded ?? 0 },
  ].filter((d) => d.value > 0);

  const maxViewers = Math.max(...topStreams.map((s) => s.connections ?? 0), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">Gerçek zamanlı sistem izleme</p>
        </div>
        <div className={cn('flex items-center gap-2 text-sm', connected ? 'text-success' : 'text-danger')}>
          <span className={cn('w-2 h-2 rounded-full', connected ? 'bg-success animate-pulse' : 'bg-danger')} />
          {connected ? 'Canlı' : 'Bağlantı Yok'}
        </div>
      </div>

      {/* Row 1 — Big live stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Aktif Bağlantı"
          value={activeConns.toLocaleString('tr')}
          icon={Users}
          variant="success"
          live={connected}
          subtitle="Son 30 saniye"
        />
        <StatCard
          title="Canlı Stream"
          value={activeStreams.toLocaleString('tr')}
          icon={Tv}
          variant="info"
          live={connected}
          subtitle="Şu an izlenen"
        />
        <StatCard
          title="Anlık Bandwidth"
          value={fmtMbps(bandwidthMbps)}
          icon={Activity}
          variant="primary"
          live={connected}
          subtitle="Bu saat tahmini"
        />
        <StatCard
          title="Toplam Kullanıcı"
          value={totalUsers.toLocaleString('tr')}
          icon={Database}
          variant="default"
          subtitle={stats ? `${stats.activeUsers.toLocaleString('tr')} aktif` : undefined}
        />
      </div>

      {/* Row 2 — Small info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SmallCard
          icon={UserPlus}
          label="Bugün Yeni Kullanıcı"
          value={stats?.newUsersToday ?? '—'}
          color="text-success"
          loading={statsLoading}
        />
        <SmallCard
          icon={Link2}
          label="Bugün Bağlantı"
          value={stats?.connectionsToday != null ? stats.connectionsToday.toLocaleString('tr') : '—'}
          color="text-info"
          loading={statsLoading}
        />
        <SmallCard
          icon={UserX}
          label="Süresi Dolmuş"
          value={stats?.expiredUsers != null ? stats.expiredUsers.toLocaleString('tr') : '—'}
          color="text-warning"
          loading={statsLoading}
        />
        <SmallCard
          icon={ShieldCheck}
          label="Stream Sağlık"
          value={stats ? `${stats.streamsUp}/${stats.totalStreams}` : '—'}
          color={stats && stats.streamsDown > 0 ? 'text-danger' : 'text-success'}
          loading={statsLoading}
          sub={stats?.streamsDown ? `${stats.streamsDown} çökmüş` : 'Tümü iyi'}
        />
      </div>

      {/* Row 3 — Connection chart + Health pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart (2/3) */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-fg">Bağlantı Grafiği</h2>
              <p className="text-xs text-muted mt-0.5">Saatlik bağlantı ve bant genişliği</p>
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
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {chartLoading ? (
            <div className="h-52 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
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
                      ? [`${val} bağlantı`, 'Bağlantı']
                      : [`${val} MB`, 'Bant Genişliği']
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

        {/* Health pie (1/3) */}
        <div className="card p-5">
          <h2 className="font-semibold text-fg mb-1">Stream Sağlık</h2>
          <p className="text-xs text-muted mb-4">Anlık durum dağılımı</p>

          {statsLoading ? (
            <div className="h-52 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : healthPie.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted text-sm">
              <ShieldCheck className="w-8 h-8 text-success opacity-60" />
              <span>Tüm streamler normal</span>
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
                    formatter={(val: number) => [`${val} stream`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-3 space-y-2">
                {[
                  { label: 'Çalışıyor', value: stats?.streamsUp ?? 0, color: 'text-success' },
                  { label: 'Çökmüş', value: stats?.streamsDown ?? 0, color: 'text-danger' },
                  { label: 'Yavaş', value: stats?.streamsDegraded ?? 0, color: 'text-warning' },
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

      {/* Row 4 — Top streams + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top streams */}
        <div className="card p-5">
          <h2 className="font-semibold text-fg mb-1">En Çok İzlenen Streamler</h2>
          <p className="text-xs text-muted mb-4">Son 24 saat, bağlantı sayısına göre</p>

          {streamsLoading ? (
            <div className="h-40 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : topStreams.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">Veri yok</div>
          ) : (
            <div className="space-y-3">
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
        <div className="card p-5">
          <h2 className="font-semibold text-fg mb-1">Son Aktiviteler</h2>
          <p className="text-xs text-muted mb-4">Kullanıcı işlem geçmişi</p>

          {activityLoading ? (
            <div className="h-40 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : activity.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted text-sm">Aktivite yok</div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {activity.map((entry) => {
                const Icon = ACTIVITY_ICON[entry.type] ?? Clock;
                return (
                  <div key={entry.id} className="flex items-start gap-3 py-1.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg truncate">{entry.description}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="font-medium">{entry.user}</span>
                        {' · '}
                        {timeAgo(entry.createdAt)}
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

function SmallCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
  sub?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted truncate">{label}</p>
        {loading ? (
          <div className="h-5 w-12 bg-surface-2 rounded animate-pulse mt-1" />
        ) : (
          <>
            <p className={cn('text-lg font-bold tabular-nums leading-tight', color)}>{value}</p>
            {sub && <p className="text-xs text-muted">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}
