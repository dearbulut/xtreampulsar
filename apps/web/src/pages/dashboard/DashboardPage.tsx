import {
  Activity,
  Users,
  Tv,
  Server,
  TrendingUp,
  Zap,
  WifiOff,
  AlertTriangle,
  Clock,
  BarChart2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useDashboard, useBandwidth, useServerStats, useTopStreams } from '@/hooks/useDashboard';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function DashboardPage() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: bandwidth } = useBandwidth();
  const { data: servers } = useServerStats();
  const { data: topStreams } = useTopStreams(5);

  const bwChartData = (bandwidth ?? []).map((b, i) => ({
    time: new Date(b.hour).getHours() + ':00',
    in: Math.round(parseFloat(b.bytesIn) / 1024 / 1024),
    out: Math.round(parseFloat(b.bytesOut) / 1024 / 1024),
    idx: i,
  }));

  // Placeholder sparkline for servers (last 7 "ticks")
  const sparkSeed = (base: number) =>
    Array.from({ length: 7 }, (_, i) => ({ v: Math.max(0, base + Math.sin(i) * (base * 0.3)) }));

  if (dashLoading && !dash) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Açık Bağlantılar"
          value={dash?.connections.active ?? 0}
          subtitle={`Bugün: ${dash?.connections.today ?? 0}`}
          icon={Activity}
          variant="warning"
          live
        />
        <StatCard
          title="Online Kullanıcılar"
          value={dash?.users.active ?? 0}
          subtitle={`Toplam: ${dash?.users.total ?? 0}`}
          icon={Users}
          variant="info"
        />
        <StatCard
          title="Online Stream"
          value={`${dash?.streams.online ?? 0} / ${dash?.streams.total ?? 0}`}
          subtitle="Aktif / Toplam"
          icon={Tv}
          variant={
            (dash?.streams.online ?? 0) === (dash?.streams.total ?? 0) ? 'success' : 'danger'
          }
        />
        <StatCard
          title="Sunucular"
          value={`${dash?.servers.online ?? 0} / ${dash?.servers.total ?? 0}`}
          subtitle="Online / Toplam"
          icon={Server}
          variant={dash?.servers.online === dash?.servers.total ? 'success' : 'warning'}
        />
      </div>

      {/* ── Second stat row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Kullanıcı"
          value={dash?.users.total ?? 0}
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          title="Offline Stream"
          value={(dash?.streams.total ?? 0) - (dash?.streams.online ?? 0)}
          icon={WifiOff}
          variant="danger"
        />
        <StatCard
          title="Offline Sunucu"
          value={(dash?.servers.total ?? 0) - (dash?.servers.online ?? 0)}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          title="Bugünkü Bağlantı"
          value={dash?.connections.today ?? 0}
          icon={Clock}
          variant="default"
        />
      </div>

      {/* ── Bandwidth chart ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm font-semibold text-slate-200">Bandwidth (24 Saat)</div>
            <div className="text-xs text-muted mt-0.5">Megabit/s cinsinden gelen/giden trafik</div>
          </div>
          <BarChart2 className="w-4 h-4 text-muted" />
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bwChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="bwIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bwOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="in" stroke="#6366f1" fill="url(#bwIn)" strokeWidth={2} name="Gelen (MB)" />
              <Area type="monotone" dataKey="out" stroke="#10b981" fill="url(#bwOut)" strokeWidth={2} name="Giden (MB)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Server cards + Top streams ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Server cards */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Sunucu Durumu</h2>
          {(servers ?? []).map((srv) => {
            const sparkData = sparkSeed(srv.activeConnections ?? 0);
            return (
              <div key={srv.id} className="card p-4 flex items-center gap-4">
                <div
                  className={cn(
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    srv.isOnline ? 'bg-success animate-pulse-slow' : 'bg-danger',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-200">{srv.name}</span>
                    <span className="text-xs font-mono text-muted">{srv.ip}:{srv.port}</span>
                    {srv.location && (
                      <span className="text-[10px] bg-surface-2 text-muted px-1.5 py-0.5 rounded">{srv.location}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {srv.activeConnections ?? 0} / {srv.maxClients} bağlantı
                    {srv.responseTime && ` • ${srv.responseTime}ms`}
                    {srv.utilization !== undefined && ` • %${srv.utilization.toFixed(0)} kullanım`}
                  </div>
                  {/* Utilization bar */}
                  <div className="mt-2 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        (srv.utilization ?? 0) > 80 ? 'bg-danger' :
                        (srv.utilization ?? 0) > 60 ? 'bg-warning' : 'bg-success',
                      )}
                      style={{ width: `${Math.min(srv.utilization ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
                {/* Sparkline */}
                <div className="w-24 h-10 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData}>
                      <defs>
                        <linearGradient id={`spark-${srv.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#6366f1"
                        fill={`url(#spark-${srv.id})`}
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
          {(!servers || servers.length === 0) && (
            <div className="card p-8 text-center text-muted text-sm">Sunucu bulunamadı</div>
          )}
        </div>

        {/* Top streams */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-slate-200">En Çok İzlenen</h2>
          </div>
          <div className="space-y-3">
            {(topStreams ?? []).map((item, i) => (
              <div key={item.stream?.id ?? i} className="flex items-center gap-3">
                <span className="w-5 text-xs text-muted font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-300 truncate">{item.stream?.name ?? '—'}</div>
                  <div className="text-xs text-muted">{item.connections} bağlantı</div>
                </div>
                <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: `${((item.connections / ((topStreams?.[0]?.connections ?? 1) || 1)) * 100).toFixed(0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {(!topStreams || topStreams.length === 0) && (
              <div className="text-center text-muted text-sm py-6">Veri yok</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
