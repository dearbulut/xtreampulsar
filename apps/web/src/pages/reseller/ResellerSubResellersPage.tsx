import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CreditCard, Users, Network } from 'lucide-react';
import {
  useResellerMe,
  useResellerSubResellers,
  useResellerCreateSubReseller,
  useResellerTransferCredits,
  type SubReseller,
} from '@/hooks/useResellerPanel';
import { Modal } from '@/components/ui/Modal';
import { cn, formatDate } from '@/lib/utils';

const TIER_COLORS: Record<string, string> = {
  BASIC: 'text-muted bg-muted/10',
  SILVER: 'text-slate-300 bg-slate-300/10',
  GOLD: 'text-warning bg-warning/10',
  PLATINUM: 'text-info bg-info/10',
};

export function ResellerSubResellersPage() {
  const { t } = useTranslation();
  const { data: me } = useResellerMe();
  const { data: subs = [], isLoading } = useResellerSubResellers();
  const createSub = useResellerCreateSubReseller();
  const transfer = useResellerTransferCredits();

  const [showCreate, setShowCreate] = useState(false);
  const [transferTarget, setTransferTarget] = useState<SubReseller | null>(null);
  const [transferAmount, setTransferAmount] = useState(10);
  const [createForm, setCreateForm] = useState({ username: '', password: '', email: '', credits: 0 });

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) return;
    await createSub.mutateAsync({
      username: createForm.username,
      password: createForm.password,
      email: createForm.email || undefined,
      credits: createForm.credits,
    });
    setShowCreate(false);
    setCreateForm({ username: '', password: '', email: '', credits: 0 });
  };

  const handleTransfer = async () => {
    if (!transferTarget || transferAmount <= 0) return;
    await transfer.mutateAsync({ subId: transferTarget.id, amount: transferAmount });
    setTransferTarget(null);
    setTransferAmount(10);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            {t('reseller.subs.title')}
          </h1>
          <p className="text-sm text-muted mt-0.5">{t('reseller.subs.subtitle', { n: subs.length })}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {t('reseller.subs.addSub')}
        </button>
      </div>

      {/* My credit info */}
      {me && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-primary" />
          <span className="text-sm text-slate-300">
            {t('reseller.subs.yourBalanceLabel')} <span className="font-bold text-primary">{me.credits}</span> {t('reseller.subs.creditsUnit')}
          </span>
        </div>
      )}

      {/* Sub-reseller list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-36" />
          ))}
        </div>
      ) : subs.length === 0 ? (
        <div className="card py-16 flex flex-col items-center gap-3 text-center">
          <Network className="w-10 h-10 text-muted/30" />
          <p className="text-muted text-sm">{t('reseller.subs.noSubs')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            {t('reseller.subs.addFirstSub')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {subs.map((sub) => (
            <SubCard
              key={sub.id}
              sub={sub}
              onTransfer={() => { setTransferTarget(sub); setTransferAmount(10); }}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('reseller.subs.addSub')} size="sm">
        <div className="space-y-4">
          {me && (
            <div className="text-sm text-muted p-2.5 rounded-lg bg-surface-2">
              {t('reseller.subs.yourBalanceLabel')} <span className="text-primary font-semibold">{me.credits} {t('reseller.subs.creditsUnit')}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('reseller.subs.usernameLabel')}</label>
              <input className="input" placeholder="altbayi1"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('reseller.subs.passwordLabel')}</label>
              <input className="input" type="password" placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{t('reseller.subs.emailLabel')}</label>
            <input className="input" type="email" placeholder="mail@example.com"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('reseller.subs.startingCredits')}</label>
            <input className="input" type="number" min={0}
              value={createForm.credits}
              onChange={(e) => setCreateForm((f) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} />
            {createForm.credits > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                {t('reseller.subs.willDeduct', { n: createForm.credits })}
                {me && me.credits < createForm.credits && (
                  <span className="text-danger ml-1">{t('reseller.subs.insufficientBalance')}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={createSub.isPending || !createForm.username || !createForm.password || (!!me && createForm.credits > me.credits)}
              onClick={() => void handleCreate()}
              className="btn-primary"
            >
              {createSub.isPending ? t('reseller.subs.creating') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Transfer credits modal */}
      <Modal
        open={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title={t('reseller.subs.transferTitle', { name: transferTarget?.username ?? '' })}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('reseller.subs.yourBalanceShort')}</span>
            <span className="font-semibold text-slate-100">{me?.credits ?? 0} {t('reseller.subs.creditsUnit')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('reseller.subs.recipientBalance')}</span>
            <span className="font-semibold text-slate-100">{transferTarget?.credits ?? 0} {t('reseller.subs.creditsUnit')}</span>
          </div>
          <div>
            <label className="label">{t('reseller.subs.transferAmount')}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={transferAmount}
              onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)}
            />
          </div>
          {me && transferAmount > me.credits && (
            <p className="text-xs text-danger">{t('reseller.subs.insufficientBalance2')}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setTransferTarget(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={transfer.isPending || transferAmount <= 0 || (!!me && transferAmount > me.credits)}
              onClick={() => void handleTransfer()}
              className="btn-primary"
            >
              {transfer.isPending ? t('reseller.subs.sending') : t('reseller.subs.sendCreditsN', { n: transferAmount })}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SubCard({ sub, onTransfer }: { sub: SubReseller; onTransfer: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono font-semibold text-slate-100">{sub.username}</div>
          {sub.email && <div className="text-xs text-muted mt-0.5">{sub.email}</div>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', TIER_COLORS[sub.tier] ?? 'text-muted bg-muted/10')}>
            {sub.tier}
          </span>
          <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium',
            sub.isActive ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-400 bg-slate-500/15')}>
            {sub.isActive ? t('common.active') : t('common.inactive')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted">
          <CreditCard className="w-3.5 h-3.5" />
          <span className={cn('font-semibold tabular-nums', sub.credits < 20 ? 'text-warning' : 'text-slate-200')}>
            {sub.credits}
          </span>
          <span className="text-xs">{t('reseller.subs.creditsUnit')}</span>
        </div>
        <div className="flex items-center gap-1 text-muted">
          <Users className="w-3.5 h-3.5" />
          <span className="text-slate-300">{sub._count?.users ?? 0}</span>
          <span className="text-xs">{t('reseller.subs.usersUnit')}</span>
        </div>
      </div>

      <div className="text-xs text-muted">{formatDate(sub.createdAt)}</div>

      <button
        onClick={onTransfer}
        className="mt-auto w-full text-sm py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
      >
        <CreditCard className="w-3.5 h-3.5" />
        {t('reseller.subs.sendCredits')}
      </button>
    </div>
  );
}
