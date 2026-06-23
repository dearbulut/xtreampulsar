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
  CreditCard,
  TrendingDown,
  TrendingUp,
  Users,
  UserCheck,
  BarChart2,
  ArrowUpCircle,
  ArrowDownCircle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/axios';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface RevenueReport {
  summary: {
    totalCreditsAdded: number;
    totalCreditsSpent: number;
    totalResellers: number;
    activeResellers: number;
    avgCreditPerReseller: number;
    topResellerRevenue: number;
  };
  trend: { date: string; creditsAdded: number; creditsSpent: number }[];
  byReseller: {
    resellerName: string;
    creditsAdded: number;
    creditsSpent: number;
    balance: number;
    userCount: number;
  }[];
  packageDistribution: {
    packageName: string;
    userCount: number;
    percentage: number;
  }[];
  recentTransactions: {
    id: string;
    resellerName: string;
    type: 'add' | 'spend';
    amount: number;
    description: string;
    createdAt: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${fmtDate(iso)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// ─── Date presets ─────────────────────────────────────────────────────────

type Preset = 'week' | 'month' | '3months' | 'custom';

const PRESET_LABELS: Record<Preset, string> = {
  week: 'Bu Hafta', month: 'Bu Ay', '3months': 'Son 3 Ay', custom: 'Özel',
};

function presetDates(p: Preset): { start: string; end: string } {
  const end = new Date().toISOString().slice(0, 10);
  const s = (days: number) => new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  if (p === 'week')    return { start: s(7),  end };
  if (p === 'month')   return { start: s(30), end };
  if (p === '3months') return { start: s(90), end };
  return { start: s(30), end };
}

// ─── CSV export ───────────────────────────────────────────────────────────

function exportCsv(report: RevenueReport, start: string, end: string) {
  const s = report.summary;
  const rows: (string | number)[][] = [
    [`Gelir Raporu — ${start} / ${end}`],
    [],
    ['Özet'],
    ['Toplam Kredi Eklendi', s.totalCreditsAdded],
    ['Toplam Kredi Harcandı', s.totalCreditsSpent],
    ['Net Bakiye', s.totalCreditsAdded - s.totalCreditsSpent],
    ['Toplam Reseller', s.totalResellers],
    ['Aktif Reseller', s.activeResellers],
    ['Reseller Başı Ortalama', s.avgCreditPerReseller],
    [],
    ['Kredi Trendi'],
    ['Tarih', 'Eklenen', 'Harcanan'],
    ...report.trend.map((t) => [t.date, t.creditsAdded, t.creditsSpent]),
    [],
    ['Reseller Özeti'],
    ['Reseller', 'Eklendi', 'Harcandı', 'Bakiye', 'Kullanıcı'],
    ...report.byReseller.map((r) => [r.resellerName, r.creditsAdded, r.creditsSpent, r.balance, r.userCount]),
    [],
    ['Son İşlemler'],
    ['Tarih', 'Reseller', 'Tür', 'Miktar', 'Açıklama'],
    ...report.recentTransactions.map((t) => [fmtDateTime(t.createdAt), t.resellerName, t.type === 'add' ? 'Eklendi' : 'Harcandı', t.amount, t.description]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gelir-raporu-${start}-${end}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Hook ─────────────────────────────────────────────────────────────────

function useRevenueReport(start: string, end: string, groupBy: 'day' | 'week' | 'month') {
  return useQuery<RevenueReport>({
    queryKey: ['analytics', 'revenue-report', start, end, groupBy],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: RevenueReport }>(
        `/analytics/revenue-report?startDate=${start}&endDate=${end}&groupBy=${groupBy}`,
      );
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function RevenuePage() {
  const [preset, setPreset]           = useState<Preset>('month');
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [customEnd, setCustomEnd]     = useState(() => new Date().toISOString().slice(0, 10));
  const [groupBy, setGroupBy]         = useState<'day' | 'week' | 'month'>('day');

  const { start, end } = preset === 'custom' ? { start: customStart, end: customEnd } : presetDates(preset);
  const { data: report, isLoading } = useRevenueReport(start, end, groupBy);

  const net = (report?.summary.totalCreditsAdded ?? 0) - (report?.summary.totalCreditsSpent ?? 0);

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Gelir Raporu</h1>
          <p className="text-sm text-muted mt-0.5">Reseller kredi hareketleri ve paket dağılımı</p>
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

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input text-xs py-1.5 px-2" />
            <span className="text-muted text-xs">—</span>
            <input type="date" value={customEnd}   onChange={(e) => setCustomEnd(e.target.value)}   className="input text-xs py-1.5 px-2" />
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
          {/* 6 summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Toplam Kredi Eklendi"
              value={report.summary.totalCreditsAdded.toLocaleString('tr')}
              icon={TrendingUp}
              variant="success"
              subtitle={`${start} — ${end}`}
            />
            <StatCard
              title="Toplam Kredi Harcandı"
              value={report.summary.totalCreditsSpent.toLocaleString('tr')}
              icon={TrendingDown}
              variant="danger"
              subtitle="Kullanıcı oluşturma"
            />
            <StatCard
              title="Net Bakiye"
              value={net.toLocaleString('tr')}
              icon={CreditCard}
              variant={net >= 0 ? 'info' : 'warning'}
              subtitle="Eklenen − Harcanan"
            />
            <StatCard
              title="Toplam Reseller"
              value={report.summary.totalResellers.toLocaleString('tr')}
              icon={Users}
              variant="default"
            />
            <StatCard
              title="Aktif Reseller"
              value={report.summary.activeResellers.toLocaleString('tr')}
              icon={UserCheck}
              variant="primary"
              subtitle="Dönemde işlem yapan"
            />
            <StatCard
              title="Reseller Başı Ortalama"
              value={report.summary.avgCreditPerReseller.toLocaleString('tr')}
              icon={BarChart2}
              variant="default"
              subtitle="Eklenen kredi"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Kredi trend */}
            <div className="card p-5">
              <h2 className="font-semibold text-fg mb-1">Kredi Trendi</h2>
              <p className="text-xs text-muted mb-4">Eklenen ve harcanan kredi karşılaştırması</p>
              {report.trend.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted text-sm">Bu dönemde işlem yok</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={report.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="addGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'var(--fg)' }}
                      formatter={(val: number, name: string) =>
                        name === 'creditsAdded' ? [`${val} kredi`, 'Eklendi'] : [`${val} kredi`, 'Harcandı']
                      }
                    />
                    <Area type="monotone" dataKey="creditsAdded" stroke="#22c55e" strokeWidth={2} fill="url(#addGrad)"   dot={false} />
                    <Area type="monotone" dataKey="creditsSpent" stroke="#ef4444" strokeWidth={2} fill="url(#spendGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Paket dağılımı */}
            <div className="card p-5">
              <h2 className="font-semibold text-fg mb-1">Paket Dağılımı</h2>
              <p className="text-xs text-muted mb-4">Kullanıcıların aktif paket dağılımı</p>
              {report.packageDistribution.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted text-sm">Veri yok</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={report.packageDistribution}
                        dataKey="userCount"
                        nameKey="packageName"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        strokeWidth={0}
                      >
                        {report.packageDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v: string) => <span className="text-xs text-muted">{v}</span>}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(val: number, name: string) => [`${val} kullanıcı`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {report.packageDistribution.slice(0, 5).map((p, i) => (
                      <div key={p.packageName} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted truncate max-w-[140px]">{p.packageName}</span>
                        </div>
                        <span className="text-fg font-medium tabular-nums">
                          {p.userCount} <span className="text-muted text-xs">({p.percentage}%)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Reseller summary */}
            <div className="card p-5 max-h-[480px] flex flex-col">
              <h2 className="font-semibold text-fg mb-1">Reseller Bazlı Özet</h2>
              <p className="text-xs text-muted mb-4">Dönem içi kredi hareketleri</p>
              <div className="overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border">
                      <th className="text-left  text-xs text-muted py-2 pr-2">Reseller</th>
                      <th className="text-right text-xs text-muted py-2 pr-2">Eklendi</th>
                      <th className="text-right text-xs text-muted py-2 pr-2">Harcandı</th>
                      <th className="text-right text-xs text-muted py-2 pr-2">Bakiye</th>
                      <th className="text-right text-xs text-muted py-2">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byReseller.map((r, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-surface-2/30">
                        <td className="py-2.5 pr-2 text-fg font-medium truncate max-w-[110px]">{r.resellerName}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-success">{r.creditsAdded.toLocaleString('tr')}</td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-danger">{r.creditsSpent.toLocaleString('tr')}</td>
                        <td className={cn('py-2.5 pr-2 text-right tabular-nums font-medium', r.balance >= 0 ? 'text-fg' : 'text-danger')}>
                          {r.balance.toLocaleString('tr')}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-muted">{r.userCount.toLocaleString('tr')}</td>
                      </tr>
                    ))}
                    {report.byReseller.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted text-sm">Veri yok</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent transactions */}
            <div className="card p-5 max-h-[480px] flex flex-col">
              <h2 className="font-semibold text-fg mb-1">Son İşlemler</h2>
              <p className="text-xs text-muted mb-4">Dönem içi son 20 kredi hareketi</p>
              <div className="overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border">
                      <th className="text-left  text-xs text-muted py-2 pr-2">Tarih</th>
                      <th className="text-left  text-xs text-muted py-2 pr-2">Reseller</th>
                      <th className="text-right text-xs text-muted py-2 pr-2">Tür</th>
                      <th className="text-right text-xs text-muted py-2">Miktar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recentTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-surface-2/30">
                        <td className="py-2.5 pr-2 text-xs text-muted whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                        <td className="py-2.5 pr-2 text-fg truncate max-w-[100px]">{t.resellerName}</td>
                        <td className="py-2.5 pr-2 text-right">
                          <span className={cn('inline-flex items-center gap-1 text-xs font-medium', t.type === 'add' ? 'text-success' : 'text-danger')}>
                            {t.type === 'add'
                              ? <ArrowUpCircle className="w-3 h-3" />
                              : <ArrowDownCircle className="w-3 h-3" />}
                            {t.type === 'add' ? 'Eklendi' : 'Harcandı'}
                          </span>
                        </td>
                        <td className={cn('py-2.5 text-right tabular-nums font-semibold', t.type === 'add' ? 'text-success' : 'text-danger')}>
                          {t.type === 'add' ? '+' : '−'}{t.amount.toLocaleString('tr')}
                        </td>
                      </tr>
                    ))}
                    {report.recentTransactions.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted text-sm">Bu dönemde işlem yok</td></tr>
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
