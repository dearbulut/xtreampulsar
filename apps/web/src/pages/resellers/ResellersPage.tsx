import { useState } from 'react';
import { Plus, CreditCard, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useResellers, useCreateReseller, useAddCredits, useDeleteReseller } from '@/hooks/useResellers';
import type { Reseller } from '@/types';
import { formatDate, cn } from '@/lib/utils';

const TIER_COLORS: Record<string, string> = {
  BASIC: 'text-muted bg-muted/10',
  SILVER: 'text-slate-300 bg-slate-300/10',
  GOLD: 'text-warning bg-warning/10',
  PLATINUM: 'text-info bg-info/10',
};

export function ResellersPage() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creditReseller, setCreditReseller] = useState<Reseller | null>(null);
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditReason, setCreditReason] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', credits: 0 });

  const { data: resellers, isLoading } = useResellers();
  const createReseller = useCreateReseller();
  const addCredits = useAddCredits();
  const deleteReseller = useDeleteReseller();

  const columns: Column<Reseller>[] = [
    {
      key: 'username',
      header: 'Kullanıcı Adı',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-200">{r.username}</div>
          <div className="text-xs text-muted">{r.email}</div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tip',
      render: (r) => (
        <span className={cn('badge', TIER_COLORS[r.tier] ?? 'text-muted bg-muted/10')}>
          {r.tier}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Durum',
      render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'DISABLED'} />,
    },
    {
      key: 'credits',
      header: 'Kredi',
      render: (r) => (
        <span className={cn('text-sm font-semibold tabular-nums', r.credits < 20 ? 'text-warning' : 'text-slate-200')}>
          {r.credits.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'users',
      header: 'Kullanıcılar',
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
      header: 'Kayıt Tarihi',
      render: (r) => <span className="text-sm text-muted">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'İşlemler',
      className: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCreditReseller(r); setCreditAmount(100); setCreditReason(''); }}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-success transition-colors"
            title="Kredi Ekle"
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteId(r.id)}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-danger transition-colors"
            title="Sil"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reseller'lar"
        description={`${resellers?.length ?? 0} reseller`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Reseller Ekle</span>
          </button>
        }
      />

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={resellers ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyTitle="Reseller bulunamadı"
          emptyDescription="Henüz reseller eklenmemiş."
        />
      </div>

      {/* Add credits modal */}
      <Modal
        open={!!creditReseller}
        onClose={() => setCreditReseller(null)}
        title={`Kredi Ekle — ${creditReseller?.username ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted mb-1">Mevcut kredi</div>
            <div className="text-2xl font-bold text-slate-100">
              {creditReseller?.credits.toLocaleString() ?? 0}
            </div>
          </div>
          <div>
            <label className="label">Eklenecek Miktar</label>
            <input
              className="input"
              type="number"
              min={1}
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="label">Neden (isteğe bağlı)</label>
            <input
              className="input"
              placeholder="Ödeme, hediye…"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreditReseller(null)} className="btn-ghost">İptal</button>
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
              {addCredits.isPending ? 'Ekleniyor…' : `${creditAmount} Kredi Ekle`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Reseller" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kullanıcı Adı</label>
              <input className="input" placeholder="reseller1"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">E-posta</label>
              <input className="input" type="email" placeholder="mail@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Şifre</label>
              <input className="input" type="password" placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="label">Başlangıç Kredisi</label>
              <input className="input" type="number" min={0}
                value={createForm.credits}
                onChange={(e) => setCreateForm((f) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">İptal</button>
            <button
              disabled={createReseller.isPending}
              onClick={() => {
                if (createForm.username && createForm.email && createForm.password) {
                  createReseller.mutate(createForm, { onSuccess: () => setShowCreate(false) });
                }
              }}
              className="btn-primary"
            >
              {createReseller.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteReseller.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title="Reseller Sil"
        message="Bu reseller ve tüm ilişkili verileri silinecek."
        confirmLabel="Sil"
        loading={deleteReseller.isPending}
      />
    </div>
  );
}
