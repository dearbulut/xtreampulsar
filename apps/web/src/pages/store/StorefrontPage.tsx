import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, Clock, Users, Loader2, ShoppingCart, PartyPopper } from 'lucide-react';
import api from '@/lib/axios';
import { usePublicPackages, useCreateOrder, type StorePackage } from '@/hooks/useStore';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

function usePublicPanelName() {
  return useQuery({
    queryKey: ['public-settings-name'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success?: boolean; data?: { panelName?: string } }>('/settings/public');
        return res.data?.data?.panelName ?? 'IPTV';
      } catch {
        return 'IPTV';
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function StorefrontPage() {
  const { t } = useTranslation();
  const { data: packages, isLoading } = usePublicPackages();
  const { data: panelName } = usePublicPanelName();
  const createOrder = useCreateOrder();
  const currency = useCurrency();

  const [selected, setSelected] = useState<StorePackage | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!selected || !email.trim()) return;
    createOrder.mutate(
      { packageId: selected.id, contactEmail: email.trim(), desiredUsername: username.trim() || undefined, note: note.trim() || undefined },
      { onSuccess: () => setDone(true) },
    );
  };

  const items = packages ?? [];

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">{panelName}</span>
          <span className="text-muted text-sm">· {t('storefront.store')}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {done ? (
          <div className="max-w-md mx-auto text-center card p-8">
            <PartyPopper className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">{t('storefront.thanksTitle')}</h2>
            <p className="text-sm text-muted">{t('storefront.thanksBody')}</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold">{t('storefront.heroTitle')}</h1>
              <p className="text-muted mt-1">{t('storefront.heroSubtitle')}</p>
            </div>

            {isLoading ? (
              <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-muted mx-auto" /></div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-muted">{t('storefront.noPackages')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((p) => (
                  <div key={p.id} className={cn('card p-5 flex flex-col', selected?.id === p.id && 'border-primary ring-1 ring-primary')}>
                    <div className="font-semibold text-lg">{p.name}</div>
                    {p.description && <p className="text-sm text-muted mt-1 flex-1">{p.description}</p>}
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-primary">{p.price > 0 ? currency.format(p.price) : t('storefront.free')}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{p.durationDays} {t('storefront.days')}</span>
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{p.maxConnections} {t('storefront.conn')}</span>
                    </div>
                    <button
                      className={cn('mt-4 w-full', selected?.id === p.id ? 'btn-primary' : 'btn-ghost border border-border')}
                      onClick={() => setSelected(p)}
                    >
                      {selected?.id === p.id ? (<span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> {t('storefront.selected')}</span>) : t('storefront.choose')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <div className="max-w-md mx-auto mt-8 card p-6">
                <div className="font-semibold mb-1">{t('storefront.orderTitle')}</div>
                <p className="text-sm text-muted mb-4">{t('storefront.orderFor')}: <span className="text-slate-200 font-medium">{selected.name}</span></p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">{t('storefront.email')} *</label>
                    <input type="email" className="input w-full" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">{t('storefront.desiredUsername')}</label>
                    <input className="input w-full" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('storefront.optional')} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">{t('storefront.note')}</label>
                    <textarea className="input w-full" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('storefront.notePlaceholder')} />
                  </div>
                </div>
                {createOrder.isError && (
                  <p className="text-sm text-danger mt-3">
                    {(createOrder.error as { response?: { data?: { message?: string } } })?.response?.data?.message || t('storefront.error')}
                  </p>
                )}
                <button className="btn-primary w-full mt-4" disabled={!email.trim() || createOrder.isPending} onClick={submit}>
                  {createOrder.isPending ? t('storefront.sending') : t('storefront.placeOrder')}
                </button>
                <p className="text-[11px] text-muted mt-2 text-center">{t('storefront.orderHint')}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
