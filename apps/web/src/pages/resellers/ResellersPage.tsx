import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CreditCard, Trash2, Users, Pencil, Network } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import {
  useResellers, useCreateReseller, useUpdateReseller,
  useAddCredits, useDeleteReseller,
} from '@/hooks/useResellers';
import type { Reseller } from '@/types';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const TIER_COLORS: Record<string, string> = {
  BASIC: 'text-muted bg-muted/10',
  SILVER: 'text-slate-300 bg-slate-300/10',
  GOLD: 'text-warning bg-warning/10',
  PLATINUM: 'text-info bg-info/10',
};

const TIERS = ['BASIC', 'SILVER', 'GOLD', 'PLATINUM'];

export function ResellersPage() {
  const { t } = useTranslation();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creditReseller, setCreditReseller] = useState<Reseller | null>(null);
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditReason, setCreditReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editReseller, setEditReseller] = useState<Reseller | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '', email: '', password: '', credits: 0, tier: 'BASIC', notes: '', parentId: '',
  });
  const [editForm, setEditForm] = useState({
    tier: 'BASIC', isActive: true, parentId: '', notes: '', maxUsers: 0, badgeText: '', badgeColor: '#6366f1', billingModel: 'CREDITS', slotsValidUntil: '',
  });

  const { data: resellers, isLoading } = useResellers();
  const createReseller = useCreateReseller();
  const updateReseller = useUpdateReseller();
  const addCredits = useAddCredits();
  const deleteReseller = useDeleteReseller();

  const openEdit = (r: Reseller) => {
    setEditReseller(r);
    setEditForm({
      tier: r.tier,
      isActive: r.isActive,
      parentId: r.parentId ?? '',
      notes: r.notes ?? '',
      maxUsers: r.maxUsers ?? 0,
      badgeText: r.badgeText ?? '',
      badgeColor: r.badgeColor ?? '#6366f1',
      billingModel: r.billingModel ?? 'CREDITS',
      slotsValidUntil: r.slotsValidUntil ? String(r.slotsValidUntil).slice(0, 10) : '',
    });
  };

  const columns: Column<Reseller>[] = [
    {
      key: 'username',
      header: t('resellersAdmin.username'),
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-200">{r.username}</span>
            {(r.children?.length ?? 0) > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                <Network className="w-2.5 h-2.5" />
                {r.children!.length}
              </span>
            )}
          </div>
          <div className="text-xs text-muted">{r.email}</div>
        </div>
      ),
    },
    {
      key: 'parent',
      header: t('resellersAdmin.parentReseller'),
      render: (r) => r.parent
        ? <span className="text-xs text-slate-300 font-mono">{r.parent.username}</span>
        : <span className="text-xs text-muted">—</span>,
    },
    {
      key: 'tier',
      header: t('resellersAdmin.tier'),
      render: (r) => (
        r.badgeText ? (
          <span className="badge" style={{ backgroundColor: (r.badgeColor || '#6366f1') + '22', color: r.badgeColor || '#6366f1' }}>
            {r.badgeText}
          </span>
        ) : (
          <span className={cn('badge', TIER_COLORS[r.tier] ?? 'text-muted bg-muted/10')}>
            {r.tier}
          </span>
        )
      ),
    },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'DISABLED'} />,
    },
    {
      key: 'credits',
      header: t('resellersAdmin.credit'),
      render: (r) => (
        <span className={cn('text-sm font-semibold tabular-nums', r.credits < 20 ? 'text-warning' : 'text-slate-200')}>
          {r.credits.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'users',
      header: t('nav.users'),
      className: 'text-center w-24',
      headerClassName: 'text-center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1 text-sm text-slate-300">
          <Users className="w-3.5 h-3.5 text-muted" />
          {r._count?.users ?? 0}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('common.createdAt'),
      render: (r) => <span className="text-sm text-muted">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-32',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-slate-300 transition-colors"
            title={t('common.edit')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setCreditReseller(r); setCreditAmount(100); setCreditReason(''); }}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-success transition-colors"
            title={t('resellersAdmin.addCredit')}
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteId(r.id)}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-danger transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const rootResellers = resellers?.filter((r) => !r.parentId) ?? [];

  return (
    <div>
      <PageHeader
        title={t('nav.resellers')}
        description={t('resellersAdmin.resellerCount', { count: resellers?.length ?? 0 })}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('resellersAdmin.addReseller')}</span>
          </button>
        }
      />

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={resellers ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyTitle={t('resellersAdmin.emptyTitle')}
          emptyDescription={t('resellersAdmin.emptyDescription')}
        />
      </div>

      {/* Add credits modal */}
      <Modal
        open={!!creditReseller}
        onClose={() => setCreditReseller(null)}
        title={t('resellersAdmin.addCreditTitle', { name: creditReseller?.username ?? '' })}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted mb-1">{t('resellersAdmin.currentCredit')}</div>
            <div className="text-2xl font-bold text-slate-100">
              {creditReseller?.credits.toLocaleString() ?? 0}
            </div>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.amountToAdd')}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">{t('resellersAdmin.reasonOptional')}</label>
            <input
              className="input"
              placeholder={t('resellersAdmin.reasonPlaceholder')}
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreditReseller(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={addCredits.isPending || creditAmount <= 0}
              onClick={() => {
                if (creditReseller && creditAmount > 0) {
                  addCredits.mutate(
                    { id: creditReseller.id, amount: creditAmount, reason: creditReason || undefined },
                    { onSuccess: () => setCreditReseller(null) },
                  );
                }
              }}
              className="btn-primary"
            >
              {addCredits.isPending ? t('resellersAdmin.adding') : t('resellersAdmin.addCreditsAmount', { n: creditAmount })}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('resellersAdmin.newReseller')} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('resellersAdmin.username')}</label>
              <input className="input" placeholder="reseller1"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('resellersAdmin.emailOptional')}</label>
              <input className="input" type="email" placeholder="mail@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('resellersAdmin.password')}</label>
              <input className="input" type="password" placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('resellersAdmin.startingCredits')}</label>
              <input className="input" type="number" min={0}
                value={createForm.credits}
                onChange={(e) => setCreateForm((f) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tier</label>
              <select className="input" value={createForm.tier}
                onChange={(e) => setCreateForm((f) => ({ ...f, tier: e.target.value }))}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('resellersAdmin.parentResellerOptional')}</label>
              <select className="input" value={createForm.parentId}
                onChange={(e) => setCreateForm((f) => ({ ...f, parentId: e.target.value }))}>
                <option value="">{t('resellersAdmin.noneIndependent')}</option>
                {rootResellers.map((r) => (
                  <option key={r.id} value={r.id}>{r.username}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.noteOptional')}</label>
            <textarea className="input min-h-[60px] resize-none" placeholder={t('resellersAdmin.notePlaceholder')}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={createReseller.isPending}
              onClick={() => {
                if (!createForm.username || !createForm.password) {
                  toast.error(t('resellersAdmin.usernamePasswordRequired'));
                  return;
                }
                createReseller.mutate(
                  {
                    username: createForm.username,
                    email: createForm.email || undefined,
                    password: createForm.password,
                    credits: createForm.credits,
                    tier: createForm.tier,
                    notes: createForm.notes || undefined,
                    parentId: createForm.parentId || undefined,
                  },
                  {
                    onSuccess: () => {
                      setShowCreate(false);
                      setCreateForm({ username: '', email: '', password: '', credits: 0, tier: 'BASIC', notes: '', parentId: '' });
                    },
                  },
                );
              }}
              className="btn-primary"
            >
              {createReseller.isPending ? t('resellersAdmin.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editReseller}
        onClose={() => setEditReseller(null)}
        title={t('resellersAdmin.editTitle', { name: editReseller?.username ?? '' })}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Tier</label>
            <select className="input" value={editForm.tier}
              onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select className="input" value={editForm.isActive ? 'active' : 'disabled'}
              onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}>
              <option value="active">{t('common.active')}</option>
              <option value="disabled">{t('common.inactive')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.parentReseller')}</label>
            <select className="input" value={editForm.parentId}
              onChange={(e) => setEditForm((f) => ({ ...f, parentId: e.target.value }))}>
              <option value="">{t('resellersAdmin.noneIndependent')}</option>
              {(resellers ?? [])
                .filter((r) => r.id !== editReseller?.id)
                .map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.maxUsers')}</label>
            <input type="number" className="input" min={0}
              value={editForm.maxUsers}
              onChange={(e) => setEditForm((f) => ({ ...f, maxUsers: parseInt(e.target.value) || 0 }))} />
            <p className="text-xs text-muted mt-1">{t('resellersAdmin.zeroUnlimited')}</p>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.billingModel')}</label>
            <select className="input" value={editForm.billingModel}
              onChange={(e) => setEditForm((f) => ({ ...f, billingModel: e.target.value }))}>
              <option value="CREDITS">{t('resellersAdmin.billingCredits')}</option>
              <option value="USERS">{t('resellersAdmin.billingUsers')}</option>
            </select>
            <p className="text-xs text-muted mt-1">
              {editForm.billingModel === 'USERS' ? t('resellersAdmin.billingUsersHint') : t('resellersAdmin.billingCreditsHint')}
            </p>
          </div>
          {editForm.billingModel === 'USERS' && (
            <div>
              <label className="label">{t('resellersAdmin.slotsValidUntil')}</label>
              <input type="date" className="input" value={editForm.slotsValidUntil}
                onChange={(e) => setEditForm((f) => ({ ...f, slotsValidUntil: e.target.value }))} />
              <p className="text-xs text-muted mt-1">{t('resellersAdmin.slotsValidUntilHint')}</p>
            </div>
          )}
          <div>
            <label className="label">{t('resellersAdmin.badgeLabel')}</label>
            <div className="flex gap-2 items-center">
              <input className="input flex-1" placeholder={t('resellersAdmin.badgePlaceholder')} maxLength={16}
                value={editForm.badgeText}
                onChange={(e) => setEditForm((f) => ({ ...f, badgeText: e.target.value }))} />
              <input type="color" className="w-11 h-10 rounded-lg border border-border bg-surface-2 cursor-pointer p-0.5"
                value={editForm.badgeColor || '#6366f1'}
                onChange={(e) => setEditForm((f) => ({ ...f, badgeColor: e.target.value }))} />
              {editForm.badgeText && (
                <span className="badge" style={{ backgroundColor: (editForm.badgeColor || '#6366f1') + '22', color: editForm.badgeColor || '#6366f1' }}>
                  {editForm.badgeText}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1">{t('resellersAdmin.badgeHint')}</p>
          </div>
          <div>
            <label className="label">{t('resellersAdmin.note')}</label>
            <textarea className="input min-h-[60px] resize-none" placeholder={t('resellersAdmin.notePlaceholder')}
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditReseller(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={updateReseller.isPending}
              onClick={() => {
                if (!editReseller) return;
                updateReseller.mutate(
                  {
                    id: editReseller.id,
                    tier: editForm.tier as Reseller['tier'],
                    isActive: editForm.isActive,
                    parentId: editForm.parentId || null,
                    notes: editForm.notes,
                    maxUsers: editForm.maxUsers,
                    badgeText: editForm.badgeText || null,
                    badgeColor: editForm.badgeText ? (editForm.badgeColor || null) : null,
                    billingModel: editForm.billingModel,
                    slotsValidUntil: editForm.billingModel === 'USERS' ? (editForm.slotsValidUntil || null) : null,
                  },
                  { onSuccess: () => setEditReseller(null) },
                );
              }}
              className="btn-primary"
            >
              {updateReseller.isPending ? t('resellersAdmin.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteReseller.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title={t('resellersAdmin.deleteTitle')}
        message={t('resellersAdmin.deleteMessage')}
        confirmLabel={t('common.delete')}
        loading={deleteReseller.isPending}
      />
    </div>
  );
}
