import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, DollarSign, BarChart2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useRevenueReport } from '@/hooks/useRevenue';
import { useResellers } from '@/hooks/useResellers';
import type { Reseller } from '@/types';
import { cn } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  BASIC: 'bg-gray-500/20 text-gray-400',
  SILVER: 'bg-slate-500/20 text-slate-300',
  GOLD: 'bg-yellow-500/20 text-yellow-400',
  PLATINUM: 'bg-purple-500/20 text-purple-400',
};

export function RevenuePage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resellerId, setResellerId] = useState('');

  const { data: report, isLoading } = useRevenueReport(startDate, endDate, resellerId || undefined);
  const { data: resellersRaw } = useResellers();
  const resellers: Reseller[] = resellersRaw ?? [];

  return (
    <div className="flex flex-col h-screen">
      <Header title="Gelir Raporu" breadcrumb={['Analitik', 'Gelir Raporu']} />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs text-muted mb-1">Başlangıç</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Bitiş</div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Reseller</div>
              <select
                value={resellerId}
                onChange={(e) => setResellerId(e.target.value)}
                className="input text-sm"
              >
                <option value="">Tümü</option>
                {resellers.map((r) => (
                  <option key={r.id} value={r.id}>{r.username}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : report ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Toplam Kullanıcı" value={report.summary.totalUsers} icon={Users} />
              <StatCard
                label="Tahmini Gelir"
                value={`€${report.summary.totalRevenue}`}
                icon={DollarSign}
                sub="5€/kullanıcı tahmini"
              />
              <StatCard
                label="Aktif Reseller"
                value={report.byReseller.length}
                icon={TrendingUp}
              />
              <StatCard
                label="Aylık Ort. Kullanıcı"
                value={report.monthly.length > 0
                  ? Math.round(report.summary.totalUsers / report.monthly.length)
                  : 0}
                icon={BarChart2}
              />
            </div>

            {/* Monthly chart */}
            {report.monthly.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>Aylık Kullanıcı & Gelir</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={report.monthly} barSize={16} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                      labelStyle={{ color: 'var(--color-fg)', fontSize: 12 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    <Bar yAxisId="left" dataKey="newUsers" name="Yeni Kullanıcı" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="totalRevenue" name="Gelir (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Reseller table */}
            {report.byReseller.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-fg)' }}>Reseller Dağılımı</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted">Reseller</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted">Tier</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted">Kullanıcı</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted">Tahmini Gelir</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-muted">Ort. Değer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byReseller.map((r) => (
                        <tr key={r.resellerId} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                          <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-fg)' }}>{r.username}</td>
                          <td className="py-2.5 px-3">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', TIER_COLORS[r.tier] ?? 'bg-primary/20 text-primary')}>
                              {r.tier}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted">{r.userCount}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-400">€{r.estimatedRevenue}</td>
                          <td className="py-2.5 px-3 text-right text-muted">
                            €{r.userCount > 0 ? (r.estimatedRevenue / r.userCount).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.monthly.length === 0 && report.byReseller.length === 0 && (
              <div className="card p-10 text-center text-muted text-sm">
                Seçilen tarih aralığında veri bulunamadı.
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
