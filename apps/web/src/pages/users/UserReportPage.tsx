import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/axios';

interface UserReport {
  statusBreakdown: Record<string, number>;
  resellerBreakdown: Array<{ resellerId: string | null; resellerName: string; count: number }>;
  trend: Array<{ day: string; count: number }>;
}

function useUserReport() {
  return useQuery<UserReport>({
    queryKey: ['user-report'],
    queryFn: async () => {
      const res = await api.get<{ data: UserReport }>('/users/report');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#4ade80',
  EXPIRED: '#f87171',
  BANNED: '#ef4444',
  TRIAL: '#facc15',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  EXPIRED: 'Süresi Dolmuş',
  BANNED: 'Yasaklı',
  TRIAL: 'Deneme',
};

function exportCsv(report: UserReport) {
  const rows = [
    ['Durum', 'Sayı'],
    ...Object.entries(report.statusBreakdown).map(([k, v]) => [STATUS_LABELS[k] ?? k, v]),
    [],
    ['Reseller', 'Kullanıcı Sayısı'],
    ...report.resellerBreakdown.map((r) => [r.resellerName, r.count]),
    [],
    ['Tarih', 'Yeni Kayıt'],
    ...report.trend.map((t) => [t.day, t.count]),
  ];
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kullanici-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UserReportPage() {
  const { data: report, isLoading } = useUserReport();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!report) return null;

  const total = Object.values(report.statusBreakdown).reduce((a, b) => a + b, 0);
  const pieData = Object.entries(report.statusBreakdown).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    value: count,
    color: STATUS_COLORS[status] ?? '#6366f1',
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Kullanıcı Raporu</h1>
          <p className="text-sm text-muted mt-0.5">Kullanıcı istatistikleri ve dağılım analizi</p>
        </div>
        <button
          onClick={() => exportCsv(report)}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          CSV İndir
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Kullanıcı"
          value={total}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Aktif"
          value={report.statusBreakdown['ACTIVE'] ?? 0}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Süresi Dolmuş"
          value={report.statusBreakdown['EXPIRED'] ?? 0}
          icon={XCircle}
          variant="danger"
        />
        <StatCard
          title="Deneme"
          value={report.statusBreakdown['TRIAL'] ?? 0}
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Pie chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Durum Dağılımı</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${v} kullanıcı`, n]}
                />
                <Legend
                  formatter={(value) => <span className="text-xs text-muted">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar chart - 30 day trend */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Son 30 Gün Yeni Kayıt</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} name="Yeni Kayıt" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reseller breakdown table */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Reseller Bazlı Dağılım</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted py-2 pr-4">Reseller</th>
                <th className="text-right text-xs text-muted py-2 pr-4">Kullanıcı Sayısı</th>
                <th className="text-right text-xs text-muted py-2">Oran</th>
              </tr>
            </thead>
            <tbody>
              {report.resellerBreakdown.map((r, i) => {
                const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-surface-2/30">
                    <td className="py-2.5 pr-4 text-slate-300">{r.resellerName}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-slate-200">{r.count}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
