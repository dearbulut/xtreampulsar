import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Download,
  Users,
  UserPlus,
  UserX,
  UserCheck,
  ShieldOff,
  BarChart2,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface UserReport {
  summary: {
    totalUsers: number;
    newUsers: number;
    expiredUsers: number;
    bannedUsers: number;
    activeUsers: number;
    avgConnectionsPerUser: number;
  };
  growth: { date: string; newUsers: number; totalUsers: number }[];
  byReseller: { resellerName: string; userCount: number; activeCount: number }[];
  expiryDistribution: { expired: number; thisWeek: number; thisMonth: number; later: number };
  topUsers: {
    userId: string;
    username: string;
    totalConnections: number;
    totalDuration: number;
    lastSeen: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}s ${m}d`;
  return `${m}d`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.floor(h / 24)} gün`;
}

// ─── Date presets ─────────────────────────────────────────────────────────

type Preset = 'week' | 'month' | '3months' | 'custom';

function presetDates(p: Preset): { start: string; end: string } {
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  const s = (days: number) => new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  if (p === 'week')    return { start: s(7),  end: endStr };
  if (p === 'month')   return { start: s(30), end: endStr };
  if (p === '3months') return { start: s(90), end: endStr };
  return { start: s(30), end: endStr };
}

const PRESET_LABELS: Record<Preset, string> = {
  week: 'Bu Hafta', month: 'Bu Ay', '3months': 'Son 3 Ay', custom: 'Özel',
};

const EXPIRY_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#22c55e'];
const EXPIRY_LABELS = ['Dolmuş', 'Bu Hafta', 'Bu Ay', 'Sonrası'];

// ─── CSV export ───────────────────────────────────────────────────────────

function exportCsv(report: UserReport, start: string, end: string) {
  const s = report.summary;
  const rows: (string | number)[][] = [
    [`Kullanıcı Raporu — ${start} / ${end}`],
    [],
    ['Özet'],
    ['Toplam Kullanıcı', s.totalUsers],
    ['Yeni Kullanıcı (dönem)', s.newUsers],
    ['Aktif Kullanıcı (son 7g)', s.activeUsers],
    ['Süresi Dolmuş', s.expiredUsers],
    ['Askıya Alınmış', s.bannedUsers],
    ['Kullanıcı Başı Ort. Bağlantı', s.avgConnectionsPerUser],
    [],
    ['Büyüme Grafiği'],
    ['Tarih', 'Yeni Kullanıcı', 'Toplam Kullanıcı'],
    ...report.growth.map((g) => [g.date, g.newUsers, g.totalUsers]),
    [],
    ['Reseller Dağılımı'],
    ['Reseller', 'Kullanıcı', 'Aktif'],
    ...report.byReseller.map((r) => [r.resellerName, r.userCount, r.activeCount]),
    [],
    ['En Aktif Kullanıcılar'],
    ['Kullanıcı', 'Bağlantı', 'Süre (sn)', 'Son Görülme'],
    ...report.topUsers.map((u) => [u.username, u.totalConnections, u.totalDuration, u.lastSeen]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kullanici-raporu-${start}-${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Hook ────────────────────────────────────────────────────────────────

function useUserReport(start: string, end: string, groupBy: 'day' | 'week' | 'month') {
  return useQuery<UserReport>({
    queryKey: ['analytics', 'user-report', start, end, groupBy],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: UserReport }>(
        `/analytics/user-report?startDate=${start}&endDate=${end}&groupBy=${groupBy}`,
      );
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function UserReportPage() {
  const [preset, setPreset] = useState<Preset>('month');
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [customEnd, setCustomEnd]   = useState(() => new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy]       = useState<'day' | 'week' | 'month'>('day');

  const { start, end } = preset === 'custom' ? { start: customStart, end: customEnd } : presetDates(preset);

  const { data: report, isLoading } = useUserReport(start, end, groupBy);

  const expiryPie = report
    ? [
        { name: 'Dolmuş',   value: report.expiryDistribution.expired   },
        { name: 'Bu Hafta', value: report.expiryDistribution.thisWeek  },
        { name: 'Bu Ay',    value: report.expiryDistribution.thisMonth },
        { name: 'Sonrası',  value: report.expiryDistribution.later     },
      ].filter((d) => d.value > 0)
    : [];

  const totalReseller = report?.byReseller.reduce((s, r) => s + r.userCount, 0) ?? 0;

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Kullanıcı Raporu</h1>
          <p className="text-sm text-muted mt-0.5">Detaylı kullanıcı istatistikleri ve analizi</p>
        </div>
        <button
          onClick={() => report && exportCsv(report, start, end)}
          disabled={!report}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          CSV İndir
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Preset buttons */}
        <div className="flex gap-1">
          {(['week', 'month', '3months', 'custom'] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-lg transition-colors',
                preset === p ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="input text-xs py-1.5 px-2"
            />
            <span className="text-muted text-xs">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="input text-xs py-1.5 px-2"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">Grupla:</span>
          <div className="flex gap-1">
            {([['day', 'Günlük'], ['week', 'Haftalık'], ['month', 'Aylık']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setGroupBy(v)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  groupBy === v ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {report && (
        <>
          {/* Summary cards — 6 cards in 2 rows of 3 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Toplam Kullanıcı"
              value={report.summary.totalUsers.toLocaleString('tr')}
              icon={Users}
              variant="primary"
            />
            <StatCard
              title="Yeni Kullanıcı"
              value={report.summary.newUsers.toLocaleString('tr')}
              icon={UserPlus}
              variant="success"
              subtitle={`${start} — ${end}`}
            />
            <StatCard
              title="Aktif Kullanıcı"
              value={report.summary.activeUsers.toLocaleString('tr')}
              icon={UserCheck}
              variant="info"
              subtitle="Son 7 günde giriş"
            />
            <StatCard
              title="Süresi Dolmuş"
              value={report.summary.expiredUsers.toLocaleString('tr')}
              icon={UserX}
              variant="danger"
            />
            <StatCard
              title="Askıya Alınmış"
              value={report.summary.bannedUsers.toLocaleString('tr')}
              icon={ShieldOff}
              variant="warning"
            />
            <StatCard
              title="Kullanıcı Başı Bağlantı"
              value={report.summary.avgConnectionsPerUser}
              icon={BarChart2}
              variant="default"
              subtitle="Ortalama"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Growth AreaChart */}
            <div className="card p-5">
              <h2 className="font-semibold text-fg mb-1">Kullanıcı Büyümesi</h2>
              <p className="text-xs text-muted mb-4">Yeni kayıt ve toplam kullanıcı</p>
              {report.growth.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted text-sm">Bu dönemde veri yok</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={report.growth} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="totGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 10, fill: 'var(--muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'var(--fg)' }}
                      formatter={(val: number, name: string) =>
                        name === 'newUsers' ? [`${val}`, 'Yeni Kullanıcı'] : [`${val}`, 'Toplam Kullanıcı']
                      }
                    />
                    <Area yAxisId="left"  type="monotone" dataKey="newUsers"   stroke="#6366f1" strokeWidth={2} fill="url(#newGrad)" dot={false} />
                    <Area yAxisId="right" type="monotone" dataKey="totalUsers" stroke="#22c55e" strokeWidth={2} fill="url(#totGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Expiry PieChart */}
            <div className="card p-5">
              <h2 className="font-semibold text-fg mb-1">Süre Bitiş Dağılımı</h2>
              <p className="text-xs text-muted mb-4">Hesap geçerlilik durumu</p>
              {expiryPie.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted text-sm">Veri yok</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={expiryPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {expiryPie.map((_, i) => (
                          <Cell key={i} fill={EXPIRY_COLORS[i % EXPIRY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v: string) => <span className="text-xs text-muted">{v}</span>}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(val: number) => [`${val} kullanıcı`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {EXPIRY_LABELS.map((label, i) => {
                      const val = [
                        report.expiryDistribution.expired,
                        report.expiryDistribution.thisWeek,
                        report.expiryDistribution.thisMonth,
                        report.expiryDistribution.later,
                      ][i];
                      return (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-muted">{label}</span>
                          <span className="font-semibold tabular-nums" style={{ color: EXPIRY_COLORS[i] }}>{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tables row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reseller breakdown */}
            <div className="card p-5 max-h-[480px] flex flex-col">
              <h2 className="font-semibold text-fg mb-1">Reseller'a Göre Dağılım</h2>
              <p className="text-xs text-muted mb-4">Kullanıcı kaynağı analizi</p>
              <div className="overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted py-2 pr-3">Reseller</th>
                      <th className="text-right text-xs text-muted py-2 pr-3">Kullanıcı</th>
                      <th className="text-right text-xs text-muted py-2 pr-3">Aktif</th>
                      <th className="text-right text-xs text-muted py-2">Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byReseller.map((r, i) => {
                      const pct = totalReseller > 0 ? Math.round((r.userCount / totalReseller) * 100) : 0;
                      return (
                        <tr key={i} className="border-b border-border/30 hover:bg-surface-2/30">
                          <td className="py-2.5 pr-3 text-fg font-medium truncate max-w-[120px]">{r.resellerName}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-fg">{r.userCount.toLocaleString('tr')}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-success">{r.activeCount.toLocaleString('tr')}</td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 10 users */}
            <div className="card p-5 max-h-[480px] flex flex-col">
              <h2 className="font-semibold text-fg mb-1">En Aktif 10 Kullanıcı</h2>
              <p className="text-xs text-muted mb-4">Toplam bağlantı sayısına göre</p>
              <div className="overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted py-2 pr-3">#</th>
                      <th className="text-left text-xs text-muted py-2 pr-3">Kullanıcı</th>
                      <th className="text-right text-xs text-muted py-2 pr-3">Bağlantı</th>
                      <th className="text-right text-xs text-muted py-2 pr-3">Süre</th>
                      <th className="text-right text-xs text-muted py-2">Son Görülme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topUsers.map((u, i) => (
                      <tr key={u.userId} className="border-b border-border/30 hover:bg-surface-2/30">
                        <td className="py-2.5 pr-3 text-muted text-xs tabular-nums">{i + 1}</td>
                        <td className="py-2.5 pr-3 text-fg font-medium truncate max-w-[120px]">{u.username}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-fg">{u.totalConnections.toLocaleString('tr')}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{fmtDuration(u.totalDuration)}</td>
                        <td className="py-2.5 text-right text-xs text-muted">{timeAgo(u.lastSeen)}</td>
                      </tr>
                    ))}
                    {report.topUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted text-sm">Veri yok</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
