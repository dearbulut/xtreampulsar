import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Percent, Link2, Save, HandCoins } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useCommissions, useCommissionRate, useSetCommissionRate,
  useMarkCommissionPaid, useDeleteCommission, useSetReferrer,
  type CommissionStatus,
} from '@/hooks/useCommissions';
import { useResellers } from '@/hooks/useResellers';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const BADGE: Record<CommissionStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PAID: 'bg-success/10 text-success',
};

export function CommissionsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useCommissions(statusFilter || undefined);
  const { data: rate } = useCommissionRate();
  const setRate = useSetCommissionRate();
  const markPaid = useMarkCommissionPaid();
  const del = useDeleteCommission();
  const setReferrer = useSetReferrer();
  const { data: resellers } = useResellers();

  const [rateInput, setRateInput] = useState('0');
  useEffect(() => { if (rate !== undefined) setRateInput(String(rate)); }, [rate]);

  const [refReseller, setRefReseller] = useState('');
  const [refCode, setRefCode] = useState('');

  const items = data?.items ?? [];
  const filters = [
    { key: '', label: t('commissions.all') },
    { key: 'PENDING', label: t('commissions.statusPending') },
    { key: 'PAID', label: t('commissions.statusPaid') },
  ];

  const resellerList = (resellers ?? []) as Array<{ id: string; username: string }>;

  return (
    <div>
      <PageHeader title={t('commissions.title')} description={t('commissions.subtitle')} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="card p-4"><div className="text-xs text-muted">{t('commissions.pendingTotal')}</div>
          <div className="text-xl font-bold text-warning mt-1">{data?.pendingTotal ?? 0} {t('commissions.credits')}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">{t('commissions.paidTotal')}</div>
          <div className="text-xl font-bold text-success mt-1">{data?.paidTotal ?? 0} {t('commissions.credits')}</div></div>
        <div className="card p-4">
          <div className="text-xs text-muted mb-1 flex items-center gap-1"><Percent className="w-3 h-3" /> {t('commissions.rate')}</div>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={100} className="input w-20" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
            <button className="btn-primary text-xs py-1.5 px-2.5 inline-flex items-center gap-1" disabled={setRate.isPending}
              onClick={() => setRate.mutate(Math.max(0, Math.min(100, parseInt(rateInput, 10) || 0)), { onSuccess: () => toast.success(t('common.saved')) })}>
              <Save className="w-3 h-3" /> {t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {/* Referans atama */}
      <div className="card p-4 mb-5">
        <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Link2 className="w-4 h-4 text-primary" /> {t('commissions.setReferrerTitle')}</div>
        <p className="text-xs text-muted mb-3">{t('commissions.setReferrerHint')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select className="input sm:w-64" value={refReseller} onChange={(e) => setRefReseller(e.target.value)}>
            <option value="">{t('commissions.pickReseller')}</option>
            {resellerList.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
          </select>
          <input className="input flex-1" value={refCode} onChange={(e) => setRefCode(e.target.value)} placeholder={t('commissions.referrerCode')} />
          <button className="btn-primary inline-flex items-center gap-1.5" disabled={!refReseller || !refCode.trim() || setReferrer.isPending}
            onClick={() => setReferrer.mutate({ resellerId: refReseller, code: refCode.trim() }, {
              onSuccess: () => { toast.success(t('commissions.referrerSet')); setRefCode(''); setRefReseller(''); },
              onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.error')),
            })}>
            {t('commissions.assign')}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm', statusFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>{f.label}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center"><HandCoins className="w-8 h-8 text-muted mx-auto mb-2 opacity-40" /><p className="text-sm text-muted">{t('commissions.empty')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-2.5">{t('commissions.earner')}</th>
                <th className="px-4 py-2.5">{t('commissions.source')}</th>
                <th className="px-4 py-2.5">{t('commissions.amount')}</th>
                <th className="px-4 py-2.5">{t('commissions.status')}</th>
                <th className="px-4 py-2.5">{t('commissions.date')}</th>
                <th className="px-4 py-2.5 text-right">{t('common.actions')}</th>
              </tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5 text-slate-200">{c.earner}</td>
                    <td className="px-4 py-2.5 text-muted">{c.source ?? '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-primary">+{c.amount} {t('commissions.credits')}</td>
                    <td className="px-4 py-2.5"><span className={cn('badge', BADGE[c.status])}>{t(`commissions.status${c.status.charAt(0) + c.status.slice(1).toLowerCase()}`)}</span></td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {c.status === 'PENDING' && (
                        <>
                          <button className="btn-ghost p-1.5" title={t('commissions.markPaid')} onClick={() => markPaid.mutate(c.id, { onSuccess: () => toast.success(t('commissions.paidToast')) })}>
                            <Check className="w-4 h-4 text-success" />
                          </button>
                          <button className="btn-ghost p-1.5" title={t('common.delete')} onClick={() => del.mutate(c.id)}>
                            <Trash2 className="w-4 h-4 text-danger" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
