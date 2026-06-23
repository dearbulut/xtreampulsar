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
  Bell,
  Timer,
  UserPlus,
  Radio,
  Upload,
  Stethoscope,
  RotateCcw,
  FileBarChart,
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
import { useDashboard, useBandwidth, useServerStats, useTopStreams, useGeoConnections } from '@/hooks/useDashboard';
import { useSocket } from '@/hooks/useSocket';
import { useExpiringCount } from '@/hooks/useBulkRenew';
import { useNotificationLogs } from '@/hooks/useUserActivity';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

// Fetch top streams sorted by uptime (longest running)
function useUptimeStreams(limit = 5) {
  return useQuery({
    queryKey: ['streams-uptime', limit],
    queryFn: async () => {
      const res = await api.get<{ data: { items: Array<{ id: string; name: string; status: string; updatedAt: string }> } }>(
        `/streams?status=ONLINE&limit=${limit}&sort=uptime`,
      );
      return res.data.data?.items ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

function formatUptime(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const ACTION_COLOR: Record<string, string> = {
  STREAM_FAIL: 'text-danger',
  SERVER_DOWN: 'text-danger',
  LOW_BANDWIDTH: 'text-warning',
  NEW_CONNECTION: 'text-info',
  USER_EXPIRY: 'text-warning',
  LOGIN: 'text-primary',
  DEFAULT: 'text-muted',
};

function alarmColor(type: string): string {
  for (const [k, v] of Object.entries(ACTION_COLOR)) {
    if (type?.includes(k)) return v;
  }
  return ACTION_COLOR.DEFAULT;
}

function useRestartAllStreams() {
  return useMutation({
    mutationFn: () => api.post('/tools/restart-all-streams'),
    onSuccess: (res) => {
      const restarted = (res.data as { restarted?: number })?.restarted ?? 0;
      toast.success(`${restarted} stream yeniden başlatıldı`);
    },
    onError: () => toast.error('Yeniden başlatma başarısız'),
  });
}

function QuickActions() {
  const navigate = useNavigate();
  const restartAll = useRestartAllStreams();

  const actions = [
    {
      label: 'Yeni Kullanıcı',
      icon: UserPlus,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 hover:bg-blue-500/20',
      onClick: () => void navigate({ to: '/users' }),
    },
    {
      label: 'Yeni Kanal',
      icon: Radio,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
      onClick: () => void navigate({ to: '/streams' }),
    },
    {
      label: 'M3U İçe Aktar',
      icon: Upload,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 hover:bg-purple-500/20',
      onClick: () => void navigate({ to: '/migration' }),
    },
    {
      label: 'Sistem Sağlığı',
      icon: Stethoscope,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 hover:bg-yellow-500/20',
      onClick: () => void navigate({ to: '/tools/advanced' }),
    },
    {
      label: 'Tümünü Yeniden Başlat',
      icon: RotateCcw,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 hover:bg-orange-500/20',
      onClick: () => {
        if (window.confirm('Tüm stream workerları yeniden başlatılsın mı?')) {
          restartAll.mutate();
        }
      },
      loading: restartAll.isPending,
    },
    {
      label: 'Raporlar',
      icon: FileBarChart,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 hover:bg-pink-500/20',
      onClick: () => void navigate({ to: '/users' }),
    },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-slate-200">Hızlı Eylemler</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            disabled={a.loading}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl transition-colors text-center disabled:opacity-60',
              a.bg,
            )}
          >
            <a.icon className={cn('w-5 h-5', a.color)} />
            <span className="text-[11px] font-medium text-slate-300 leading-tight">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { connected } = useSocket();
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: bandwidth } = useBandwidth();
  const { data: servers } = useServerStats();
  const { data: topStreams } = useTopStreams(5);
  const { data: geoData } = useGeoConnections();
  const { data: expiringCount } = useExpiringCount(7);
  const { data: alarmLogs = [] } = useNotificationLogs(5);
  const { data: uptimeStreams = [] } = useUptimeStreams(5);
  const navigate = useNavigate();

  const bwChartData = (bandwidth ?? []).map((b, i) => ({
    time: new Date(b.hour).getHours() + ':00',
    in: Math.round(parseFloat(b.bytesIn) / 1024 / 1024),
    out: Math.round(parseFloat(b.bytesOut) / 1024 / 1024),
    idx: i,
  }));

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
      {/* ── Live connection indicator ── */}
      <div className="flex justify-end">
        <div className={cn(
          'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border',
          connected
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-slate-700 bg-surface-1 text-muted',
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500',
          )} />
          {connected ? 'Canlı' : 'Bağlantı kesildi'}
        </div>
      </div>

      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Açık Bağlantılar"
          value={dash?.connections.active ?? 0}
          subtitle={`Bugün: ${dash?.connections.today ?? 0}`}
          icon={Activity}
          variant={(dash?.connections.active ?? 0) > 0 ? 'success' : 'default'}
          live={(dash?.connections.active ?? 0) > 0}
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
          subtitle="Çalışıyor / Toplam"
          icon={Tv}
          variant={(dash?.streams.online ?? 0) > 0 ? 'success' : 'danger'}
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

      {/* Expiring soon warning */}
      {expiringCount !== undefined && expiringCount > 0 && (
        <button
          onClick={() => void navigate({ to: '/users' })}
          className="w-full card p-4 flex items-center gap-3 border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors text-left"
        >
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-warning">7 Gün İçinde Sona Erecek: {expiringCount} kullanıcı</div>
            <div className="text-xs text-muted">Kullanıcı listesine gitmek için tıklayın</div>
          </div>
        </button>
      )}

      {/* ── Hızlı Eylemler ── */}
      <QuickActions />

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

      {/* ── Server cards + Top streams + Uptime + Alarms ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Server cards */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Sunucu Durumu</h2>
          {(servers ?? []).map((srv) => {
            const sparkData = sparkSeed(srv.activeConnections ?? 0);
            const util = srv.utilization ?? 0;
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
                    {srv.utilization !== undefined && ` • %${util.toFixed(0)} kullanım`}
                  </div>
                  {/* Utilization bar — color coded: green <70%, yellow 70-90%, red >90% */}
                  <div className="mt-2 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        util > 90 ? 'bg-danger' : util > 70 ? 'bg-warning' : 'bg-success',
                      )}
                      style={{ width: `${Math.min(util, 100)}%` }}
                    />
                  </div>
                </div>
                {/* Mini sparkline */}
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

        {/* Geo watch map */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-slate-200">İzleme Haritası</h2>
          </div>
          <div className="space-y-2">
            {(geoData ?? []).slice(0, 10).map((entry) => {
              const max = geoData?.[0]?.count ?? 1;
              const pct = Math.round((entry.count / max) * 100);
              const flag = entry.countryCode
                .toUpperCase()
                .split('')
                .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
                .join('');
              return (
                <div key={entry.countryCode} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-base">{flag}</span>
                  <span className="w-24 text-xs text-slate-300 truncate">{entry.country}</span>
                  <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-xs text-muted text-right">{entry.count}</span>
                </div>
              );
            })}
            {(!geoData || geoData.length === 0) && (
              <div className="text-center text-muted text-sm py-6">Aktif bağlantı yok</div>
            )}
          </div>
        </div>

        {/* En Uzun Çalışan Streamler */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-success" />
            <h2 className="text-sm font-semibold text-slate-200">En Uzun Çalışan Streamler</h2>
          </div>
          <div className="space-y-3">
            {uptimeStreams.map((s, i) => (
              <div key={s.id ?? i} className="flex items-center gap-3">
                <span className="w-5 text-xs text-muted font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-300 truncate">{s.name}</div>
                  <div className="font-mono text-xs text-success">{formatUptime(s.updatedAt)}</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
              </div>
            ))}
            {uptimeStreams.length === 0 && (
              <div className="text-center text-muted text-sm py-6">Online stream yok</div>
            )}
          </div>
        </div>

        {/* Alarm Merkezi */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-slate-200">Son Alarmlar</h2>
          </div>
          <div className="space-y-2">
            {(alarmLogs as Array<{ id?: string; type?: string; subject?: string; recipient?: string; createdAt?: string }>).map((log, i) => (
              <div key={log.id ?? i} className="flex items-start gap-2 text-xs">
                <span className={cn('mt-0.5 flex-shrink-0 font-semibold', alarmColor(log.type ?? ''))}>●</span>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-300 truncate">{log.subject ?? log.type ?? '—'}</div>
                  <div className="text-muted">{log.createdAt ? new Date(log.createdAt).toLocaleString('tr-TR') : ''}</div>
                </div>
              </div>
            ))}
            {alarmLogs.length === 0 && (
              <div className="text-center text-muted text-sm py-6">Alarm yok</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
