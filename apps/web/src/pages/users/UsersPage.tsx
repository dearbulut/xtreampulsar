import { useState } from 'react';
import { Plus, Search, Copy, Check, Clock, Wifi, Ban, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import {
  useUsers, useCreateUser, useExtendUser, useBanUser, useUnbanUser,
  useKickUser, useDeleteUser,
} from '@/hooks/useUsers';
import { useBouquets } from '@/hooks/useBouquets';
import type { User } from '@/types';
import { daysLeft, formatDate, cn } from '@/lib/utils';

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [banId, setBanId] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    username: '', password: '', maxConnections: 1, expiresAt: '', notes: '', bouquetIds: [] as string[],
  });

  const { data, isLoading } = useUsers({ page, limit: 25, search, status });
  const { data: bouquets = [] } = useBouquets();
  const createUser = useCreateUser();
  const extendUser = useExtendUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const kickUser = useKickUser();
  const deleteUser = useDeleteUser();

  const copyCredentials = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const columns: Column<User>[] = [
    {
      key: 'username',
      header: 'Kullanıcı',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div>
            <div className="text-sm font-medium text-slate-200 font-mono">{r.username}</div>
            {r.notes && <div className="text-xs text-muted truncate max-w-24">{r.notes}</div>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); copyCredentials(r.username, r.id); }}
            className="text-muted hover:text-slate-200 transition-colors"
            title="Kopyala"
          >
            {copiedId === r.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'expiresAt',
      header: 'Son Tarih',
      render: (r) => {
        const days = daysLeft(r.expiresAt);
        return (
          <div>
            <div className="text-sm text-slate-300">{formatDate(r.expiresAt)}</div>
            <div className={cn('text-xs', days < 7 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-muted')}>
              {days < 0 ? 'Süresi doldu' : `${days} gün kaldı`}
            </div>
          </div>
        );
      },
    },
    {
      key: 'maxConnections',
      header: 'Bağlantı',
      className: 'text-center w-24',
      headerClassName: 'text-center',
      render: (r) => (
        <div className="text-center">
          <span className="text-sm text-slate-200 font-semibold">
            {r._count?.connections ?? 0}
          </span>
          <span className="text-xs text-muted">/{r.maxConnections}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      render: (r) => (
        <span className="badge bg-primary/10 text-primary-light">{r.role}</span>
      ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      className: 'w-44',
      render: (r) => (
        <div className="flex items-center gap-1">
          <ActionBtn icon={Clock} title="Süre uzat" color="text-info"
            onClick={() => { setExtendId(r.id); setExtendDays(30); }} />
          <ActionBtn icon={Pencil} title="Düzenle" color="text-muted" onClick={() => {}} />
          <ActionBtn icon={Wifi} title="Bağlantıları kes" color="text-warning"
            onClick={() => kickUser.mutate(r.id)} />
          {r.status === 'BANNED' ? (
            <ActionBtn icon={Check} title="Yasağı kaldır" color="text-success"
              onClick={() => unbanUser.mutate(r.id)} />
          ) : (
            <ActionBtn icon={Ban} title="Yasakla" color="text-warning"
              onClick={() => setBanId(r.id)} />
          )}
          <ActionBtn icon={Trash2} title="Sil" color="text-danger"
            onClick={() => setDeleteId(r.id)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        description={`${data?.total ?? 0} kullanıcı`}
        actions={
          <>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Kullanıcı Ekle</span>
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            className="input pl-9"
            placeholder="Kullanıcı adı ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto min-w-40"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="EXPIRED">Süresi Doldu</option>
          <option value="BANNED">Yasaklı</option>
          <option value="DISABLED">Devre Dışı</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages}
          total={data?.total}
          onPageChange={setPage}
          emptyTitle="Kullanıcı bulunamadı"
          emptyDescription="Arama kriterlerinize uygun kullanıcı yok."
        />
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Kullanıcı" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Kullanıcı Adı</label>
              <input className="input" placeholder="user123"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">Şifre</label>
              <input className="input" type="password" placeholder="••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Maks. Bağlantı</label>
              <input className="input" type="number" min={1} max={10}
                value={createForm.maxConnections}
                onChange={(e) => setCreateForm((f) => ({ ...f, maxConnections: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="label">Son Tarih</label>
              <input className="input" type="datetime-local"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notlar (isteğe bağlı)</label>
            <input className="input" placeholder="Not ekle…"
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {bouquets.length > 0 && (
            <div>
              <label className="label">Bouquet'ler (isteğe bağlı)</label>
              <MultiSelect
                options={bouquets.map((b) => ({ value: b.id, label: b.name }))}
                value={createForm.bouquetIds}
                onChange={(v) => setCreateForm((f) => ({ ...f, bouquetIds: v }))}
                placeholder="Bouquet seçin…"
              />
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">İptal</button>
            <button
              disabled={createUser.isPending}
              onClick={() => {
                if (createForm.username && createForm.password && createForm.expiresAt) {
                  const { bouquetIds, ...rest } = createForm;
                  createUser.mutate(
                    { ...rest, expiresAt: new Date(createForm.expiresAt).toISOString(), ...(bouquetIds.length > 0 ? { bouquetIds } : {}) },
                    { onSuccess: () => setShowCreate(false) },
                  );
                }
              }}
              className="btn-primary"
            >
              {createUser.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Extend modal */}
      <Modal open={!!extendId} onClose={() => setExtendId(null)} title="Süre Uzat" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Kaç gün uzatılsın?</label>
            <input
              className="input"
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setExtendId(null)} className="btn-ghost">İptal</button>
            <button
              disabled={extendUser.isPending}
              onClick={() => {
                if (extendId) {
                  extendUser.mutate({ id: extendId, days: extendDays }, {
                    onSuccess: () => setExtendId(null),
                  });
                }
              }}
              className="btn-primary"
            >
              {extendUser.isPending ? 'Uzatılıyor…' : 'Uzat'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Ban confirm */}
      <ConfirmDialog
        open={!!banId}
        onClose={() => setBanId(null)}
        onConfirm={() => { if (banId) banUser.mutate(banId, { onSuccess: () => setBanId(null) }); }}
        title="Kullanıcıyı Yasakla"
        message="Bu kullanıcı yasaklanacak ve aktif bağlantıları kesilecek."
        confirmLabel="Yasakla"
        loading={banUser.isPending}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title="Kullanıcıyı Sil"
        message="Bu kullanıcı kalıcı olarak silinecek."
        confirmLabel="Sil"
        loading={deleteUser.isPending}
      />
    </div>
  );
}

function ActionBtn({
  icon: Icon, title, color, onClick,
}: { icon: React.ElementType; title: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn('p-1.5 rounded-lg hover:bg-surface-2 transition-colors', color)}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
