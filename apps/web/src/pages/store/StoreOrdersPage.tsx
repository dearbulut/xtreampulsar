import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, CircleCheck, Ban, CreditCard, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useStoreOrders, useFulfillOrder, useSetOrderStatus, type StoreOrder, type StoreOrderStatus } from '@/hooks/useStore';
import { copyToClipboard } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<StoreOrderStatus, string> = {
  PENDING: 'bg-warning/10 text-warning',
  PAID: 'bg-primary/10 text-primary',
  FULFILLED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
};

export function StoreOrdersPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useStoreOrders(statusFilter || undefined);
  const fulfill = useFulfillOrder();
  const setStatus = useSetOrderStatus();
  const currency = useCurrency();
  const [copied, setCopied] = useState<string | null>(null);
  const [creds, setCreds] = useState<Record<string, { username: string; password: string }>>({});

  const items = data?.items ?? [];
  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const copy = (v: string, k: string) => { void copyToClipboard(v); setCopied(k); setTimeout(() => setCopied(null), 1200); };

  const doFulfill = (o: StoreOrder) => {
    fulfill.mutate(o.id, {
      onSuccess: (d) => {
        if (d.provisionedUsername && d.provisionedPassword) {
          setCreds((c) => ({ ...c, [o.id]: { username: d.provisionedUsername!, password: d.provisionedPassword! } }));
        }
        toast.success(t('store.fulfilled'));
      },
      onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.error')),
    });
  };

  const filters: { key: string; label: string }[] = [
    { key: '', label: t('store.all') },
    { key: 'PENDING', label: t('store.statusPending') },
    { key: 'PAID', label: t('store.statusPaid') },
    { key: 'FULFILLED', label: t('store.statusFulfilled') },
    { key: 'CANCELLED', label: t('store.statusCancelled') },
  ];

  return (
    <div>
      <PageHeader
        title={t('store.ordersTitle')}
        description={t('store.ordersSubtitle')}
        actions={
          <a href="/store" target="_blank" rel="noreferrer" className="btn-ghost text-sm inline-flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> {t('store.openStorefront')}
          </a>
        }
      />

      <div className="flex items-center gap-1.5 mb-3">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm', statusFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
            {f.label}
            {f.key === 'PENDING' && (data?.pending ?? 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px]">{data?.pending}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{t('store.noOrders')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                  <th className="px-4 py-2.5">{t('store.package')}</th>
                  <th className="px-4 py-2.5">{t('store.contact')}</th>
                  <th className="px-4 py-2.5">{t('store.price')}</th>
                  <th className="px-4 py-2.5">{t('store.status')}</th>
                  <th className="px-4 py-2.5">{t('store.date')}</th>
                  <th className="px-4 py-2.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const shown = creds[o.id] ?? (o.provisionedUsername && o.provisionedPassword ? { username: o.provisionedUsername, password: o.provisionedPassword } : null);
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 align-top hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">{o.packageName}</div>
                        {o.desiredUsername && <div className="text-xs text-muted">{t('store.desiredUsername')}: {o.desiredUsername}</div>}
                        {o.note && <div className="text-xs text-muted truncate max-w-[200px]" title={o.note}>“{o.note}”</div>}
                        {shown && (
                          <div className="mt-1.5 inline-flex flex-col gap-1 rounded-lg bg-surface-2 p-2 text-xs">
                            <div className="flex items-center gap-2"><span className="text-muted w-16">{t('store.username')}</span>
                              <span className="font-mono text-slate-200">{shown.username}</span>
                              <button className="btn-ghost p-0.5" onClick={() => copy(shown.username, o.id + 'u')}>{copied === o.id + 'u' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}</button>
                            </div>
                            <div className="flex items-center gap-2"><span className="text-muted w-16">{t('store.password')}</span>
                              <span className="font-mono text-slate-200">{shown.password}</span>
                              <button className="btn-ghost p-0.5" onClick={() => copy(shown.password, o.id + 'p')}>{copied === o.id + 'p' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-200 truncate max-w-[180px]">{o.contactEmail}</span>
                          <button className="btn-ghost p-0.5" onClick={() => copy(o.contactEmail, o.id + 'e')}>{copied === o.id + 'e' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{o.price > 0 ? currency.format(o.price) : '—'}</td>
                      <td className="px-4 py-3"><span className={cn('badge', STATUS_BADGE[o.status])}>{t(`store.status${o.status.charAt(0) + o.status.slice(1).toLowerCase()}`)}</span></td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{fmt(o.createdAt)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {o.status !== 'FULFILLED' && o.status !== 'CANCELLED' && (
                          <div className="inline-flex items-center gap-1">
                            {o.status === 'PENDING' && (
                              <button className="btn-ghost p-1.5" title={t('store.markPaid')} onClick={() => setStatus.mutate({ id: o.id, status: 'PAID' })}>
                                <CreditCard className="w-4 h-4 text-primary" />
                              </button>
                            )}
                            <button className="btn-primary text-xs py-1 px-2 inline-flex items-center gap-1" disabled={fulfill.isPending} onClick={() => doFulfill(o)}>
                              <CircleCheck className="w-3.5 h-3.5" /> {t('store.fulfill')}
                            </button>
                            <button className="btn-ghost p-1.5" title={t('store.cancel')} onClick={() => setStatus.mutate({ id: o.id, status: 'CANCELLED' })}>
                              <Ban className="w-4 h-4 text-danger" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
