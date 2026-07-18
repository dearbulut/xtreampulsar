import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { useResellerCreditHistory, useResellerDashboard } from '@/hooks/useResellerPanel';
import { useQueryClient } from '@tanstack/react-query';
import { cn, formatDate } from '@/lib/utils';

type Period = '1w' | '1m' | '3m' | 'all';

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: '1w', label: 'reseller.credits.period1w', days: 7 },
  { key: '1m', label: 'reseller.credits.period1m', days: 30 },
  { key: '3m', label: 'reseller.credits.period3m', days: 90 },
  { key: 'all', label: 'reseller.credits.periodAll', days: null },
];

function getStartDate(days: number | null): string | undefined {
  if (days === null) return undefined;
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString();
}

export function ResellerCreditsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('1m');
  const [page, setPage] = useState(1);

  const activePeriod = PERIODS.find((p) => p.key === period)!;
  // useMemo: Date.now() her render'da farklı milisaniye üretir → queryKey değişir → sonsuz fetch döngüsü
  const startDate = useMemo(() => getStartDate(activePeriod.days), [activePeriod.days]);

  const qc = useQueryClient();
  const { data: dashboard } = useResellerDashboard();
  const { data, isLoading, isError } = useResellerCreditHistory(page, 30, startDate);

  const credits = dashboard?.credits ?? 0;

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    setPage(1);
  };

  const handleRetry = () => {
    void qc.invalidateQueries({ queryKey: ['reseller-panel', 'credits'] });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{t('reseller.credits.title')}</h1>
        <p className="text-sm text-muted">{t('reseller.credits.subtitle')}</p>
      </div>

      {/* Balance + summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/15 text-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted">{t('reseller.credits.currentBalance')}</div>
            <div className="text-3xl font-bold text-primary">{credits}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/15 text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted">{t('reseller.credits.addedInPeriod')}</div>
            <div className="text-2xl font-bold text-emerald-400">+{data?.summary.added ?? 0}</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/15 text-red-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted">{t('reseller.credits.spentInPeriod')}</div>
            <div className="text-2xl font-bold text-red-400">-{data?.summary.spent ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-1.5">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePeriod(key)}
            className={cn('text-sm px-3 py-1.5 rounded-lg border transition-colors',
              period === key
                ? 'bg-primary/20 border-primary text-primary'
                : 'border-border text-muted hover:border-primary/40 hover:text-slate-300')}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <AlertTriangle className="w-8 h-8 text-amber-400 opacity-70" />
            <p className="text-sm text-muted">{t('reseller.credits.loadFailed')}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('reseller.credits.retry')}
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted">
            <CreditCard className="w-8 h-8 opacity-30" />
            <p className="text-sm">{t('reseller.credits.noTransactions')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">{t('reseller.credits.colDate')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">{t('reseller.credits.colType')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">{t('reseller.credits.colDescription')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted">{t('reseller.credits.colAmount')}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted">{t('reseller.credits.colBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => {
                  const isAdd = entry.type === 'ADD';
                  return (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-surface-2/50">
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(entry.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium',
                          isAdd ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                          {isAdd ? t('reseller.credits.typeAdded') : t('reseller.credits.typeSpent')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">
                        {entry.reason ?? '—'}
                      </td>
                      <td className={cn('px-4 py-3 text-right font-mono font-semibold text-sm',
                        isAdd ? 'text-emerald-400' : 'text-red-400')}>
                        {isAdd ? '+' : '-'}{entry.amount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                        {entry.balanceAfter}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {(data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost p-1.5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-muted">{page} / {data?.totalPages}</span>
          <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
