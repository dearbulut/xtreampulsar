import { useState, useCallback } from 'react';
import { Plus, Search, Copy, Check, Clock, Wifi, Ban, Trash2, Pencil, QrCode, Download, RefreshCw, Square, CheckSquare, Activity, SlidersHorizontal, ChevronDown, ChevronUp, BarChart2, User as UserIcon } from 'lucide-react';
import { useResellers } from '@/hooks/useResellers';
import { useUserActivity } from '@/hooks/useUserActivity';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import {
  useUsers, useCreateUser, useExtendUser, useBanUser, useUnbanUser,
  useKickUser, useDeleteUser, useUpdateUser,
} from '@/hooks/useUsers';
import { useBulkRenew } from '@/hooks/useBulkRenew';
import { usePackages } from '@/hooks/usePackages';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useBouquets } from '@/hooks/useBouquets';
import type { User } from '@/types';
import { daysLeft, formatDate, cn } from '@/lib/utils';

interface UserStats {
  totalWatchSeconds: number;
  thisMonthConnections: number;
  lastMonthConnections: number;
  topChannels: { streamId: string; name: string; tvgLogo: string | null; count: number }[];
}

function useUserStats(userId: string | null) {
  return useQuery({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: UserStats }>(`/users/${userId}/stats`);
      return res.data.data;
    },
    enabled: !!userId,
  });
}

function formatWatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

function getParam(key: string) {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

function setParam(key: string, value: string) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value); else params.delete(key);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => getParam('search'));
  const [status, setStatus] = useState(() => getParam('status'));
  const [resellerId, setResellerId] = useState(() => getParam('resellerId'));
  const [packageId, setPackageId] = useState(() => getParam('packageId'));
  const [expiresInDays, setExpiresInDays] = useState(() => getParam('expiresInDays'));
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = useCallback(<T extends string>(setter: (v: T) => void, key: string) => (value: T) => {
    setter(value);
    setParam(key, value);
    setPage(1);
  }, []);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [banId, setBanId] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [qrUserId, setQrUserId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ qrCodeImage: string; serverUrl: string; username: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '', password: '', maxConnections: 1, expiresAt: '', notes: '', bouquetIds: [] as string[],
  });
  // Bulk renew state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkRenew, setShowBulkRenew] = useState(false);
  const [bulkPackageId, setBulkPackageId] = useState('');
  const [activityUserId, setActivityUserId] = useState<string | null>(null);

  const { data, isLoading } = useUsers({ page, limit: 25, search, status, resellerId: resellerId || undefined, packageId: packageId || undefined });
  const { data: bouquets = [] } = useBouquets();
  const { data: packages = [] } = usePackages();
  const { data: resellers = [] } = useResellers();
  const qc = useQueryClient();
  const bulkRenew = useBulkRenew();
  const createUser = useCreateUser();
  const extendUser = useExtendUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const kickUser = useKickUser();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();

  const copyCredentials = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportCsv = () => {
    const rows = data?.items ?? [];
    if (!rows.length) { toast.error('Dışa aktarılacak veri yok'); return; }
    const header = ['Kullanıcı Adı', 'Durum', 'Paket', 'Bitiş Tarihi', 'Maks Bağlantı', 'Oluşturulma'];
    const lines = rows.map((u: User) => [
      u.username,
      u.status,
      (u as User & { package?: { name: string } }).package?.name ?? '',
      u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('tr-TR') : '',
      u.maxConnections,
      new Date(u.createdAt).toLocaleDateString('tr-TR'),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<User>[] = [
    {
      key: 'select' as keyof User,
      header: '',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedIds((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; }); }}
          className="text-muted hover:text-primary"
        >
          {selectedIds.has(r.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
        </button>
      ),
    },
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
          <ActionBtn icon={QrCode} title="QR Kod" color="text-info"
            onClick={async () => {
              setQrUserId(r.id);
              setQrLoading(true);
              try {
                const res = await api.get<{ success: boolean; data: { qrCodeImage: string; serverUrl: string; username: string } }>(`/users/${r.id}/qr`);
                setQrData(res.data.data);
              } catch {
                toast.error('QR kod alınamadı');
                setQrUserId(null);
              } finally {
                setQrLoading(false);
              }
            }} />
          <ActionBtn icon={Activity} title="Aktivite" color="text-primary"
            onClick={() => setActivityUserId(r.id)} />
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
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowBulkRenew(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                {selectedIds.size} Seçili Yenile
              </button>
            )}
            <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5 text-sm" title="CSV İndir">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Rapor İndir</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Kullanıcı Ekle</span>
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card mb-4">
        {/* Always-visible row */}
        <div className="p-3 flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              className="input pl-9 h-9"
              placeholder="Kullanıcı adı ara…"
              value={search}
              onChange={(e) => updateFilter(setSearch, 'search')(e.target.value)}
            />
          </div>
          <select
            className="input h-9 w-auto min-w-36"
            value={status}
            onChange={(e) => updateFilter(setStatus, 'status')(e.target.value)}
          >
            <option value="">Tüm Durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="EXPIRED">Süresi Doldu</option>
            <option value="BANNED">Yasaklı</option>
            <option value="DISABLED">Devre Dışı</option>
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('btn-ghost h-9 flex items-center gap-1.5 text-sm', showFilters && 'text-primary')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Gelişmiş Filtre
            {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible advanced filters */}
        {showFilters && (
          <div className="border-t border-border p-3 flex flex-wrap gap-2.5 bg-surface-2/30">
            <select
              className="input h-9 w-auto min-w-40"
              value={resellerId}
              onChange={(e) => updateFilter(setResellerId, 'resellerId')(e.target.value)}
            >
              <option value="">Tüm Resellerlar</option>
              {resellers.map((r: { id: string; username: string }) => (
                <option key={r.id} value={r.id}>{r.username}</option>
              ))}
            </select>
            <select
              className="input h-9 w-auto min-w-40"
              value={packageId}
              onChange={(e) => updateFilter(setPackageId, 'packageId')(e.target.value)}
            >
              <option value="">Tüm Paketler</option>
              {packages.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input h-9 w-auto min-w-44"
              value={expiresInDays}
              onChange={(e) => updateFilter(setExpiresInDays, 'expiresInDays')(e.target.value)}
            >
              <option value="">Bitiş — Tümü</option>
              <option value="7">7 gün içinde bitiyor</option>
              <option value="14">14 gün içinde bitiyor</option>
              <option value="30">30 gün içinde bitiyor</option>
            </select>
            {(resellerId || packageId || expiresInDays) && (
              <button
                onClick={() => {
                  updateFilter(setResellerId, 'resellerId')('');
                  updateFilter(setPackageId, 'packageId')('');
                  updateFilter(setExpiresInDays, 'expiresInDays')('');
                }}
                className="btn-ghost h-9 text-sm text-red-400"
              >
                Temizle
              </button>
            )}
          </div>
        )}
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
          onRowClick={(r) => setDetailUserId(r.id)}
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

      {/* Bulk Renew Modal */}
      <Modal open={showBulkRenew} onClose={() => setShowBulkRenew(false)} title={`${selectedIds.size} Kullanıcıyı Yenile`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Paket Seç</label>
            <select className="input" value={bulkPackageId} onChange={(e) => setBulkPackageId(e.target.value)}>
              <option value="">— Paket seçin —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.durationDays} gün, {p.creditCost} kredi)</option>
              ))}
            </select>
          </div>
          {bulkPackageId && (
            <p className="text-xs text-muted">
              Seçilen {selectedIds.size} kullanıcı {packages.find((p) => p.id === bulkPackageId)?.durationDays ?? 0} gün uzatılacak.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setShowBulkRenew(false)}>İptal</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!bulkPackageId || bulkRenew.isPending}
              onClick={async () => {
                if (!bulkPackageId) return;
                await bulkRenew.mutateAsync({ userIds: [...selectedIds], packageId: bulkPackageId });
                setShowBulkRenew(false);
                setSelectedIds(new Set());
                void qc.invalidateQueries({ queryKey: ['users'] });
              }}
            >
              <RefreshCw className="w-4 h-4" />
              {bulkRenew.isPending ? 'Yenileniyor…' : 'Yenile'}
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

      {/* QR Code Modal */}
      <Modal open={!!qrUserId} onClose={() => { setQrUserId(null); setQrData(null); }} title="Kullanıcı QR Kodu" size="sm">
        <div className="space-y-4 py-2">
          {qrLoading && <p className="text-muted text-sm text-center">Yükleniyor…</p>}
          {qrData && (
            <>
              <div className="flex flex-col items-center gap-3">
                <img src={qrData.qrCodeImage} alt="QR Kod" className="w-52 h-52 rounded-xl border border-border" />
                <p className="text-xs text-muted text-center">IPTV Smarters ile tarayın</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Kullanıcı adı</span>
                  <span className="text-slate-200 font-mono">{qrData.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Sunucu URL</span>
                  <span className="text-slate-200 font-mono text-xs">{qrData.serverUrl}</span>
                </div>
                <p className="text-xs text-yellow-400">Şifreyi IPTV Smarters'a manuel girin.</p>
              </div>
              <button
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = qrData.qrCodeImage;
                  a.download = `qr-${qrData.username}.png`;
                  a.click();
                }}
              >
                <Download className="w-4 h-4" /> PNG İndir
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Aktivite Modal */}
      {activityUserId && (
        <ActivityModal userId={activityUserId} onClose={() => setActivityUserId(null)} />
      )}

      {/* Kullanıcı Detay Modal */}
      {detailUserId && (
        <UserDetailModal
          userId={detailUserId}
          user={data?.items.find((u) => u.id === detailUserId) ?? null}
          onClose={() => setDetailUserId(null)}
          packages={packages}
          onUpdate={(id, updateData) => updateUser.mutate({ id, data: updateData })}
        />
      )}
    </div>
  );
}

interface UserDetailModalProps {
  userId: string;
  user: User | null;
  onClose: () => void;
  packages: { id: string; name: string; durationDays: number; creditCost: number }[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}

function UserDetailModal({ userId, user, onClose, packages, onUpdate }: UserDetailModalProps) {
  const [tab, setTab] = useState<'general' | 'activity' | 'stats'>('general');
  const [editPassword, setEditPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { data: activityData, isLoading: activityLoading } = useUserActivity(userId);
  const { data: stats, isLoading: statsLoading } = useUserStats(userId);

  if (!user) return null;

  const days = daysLeft(user.expiresAt);

  return (
    <Modal open onClose={onClose} title={`Kullanıcı: ${user.username}`} size="lg">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: 'general', label: 'Genel', icon: UserIcon },
          { key: 'activity', label: 'Bağlantı Geçmişi', icon: Activity },
          { key: 'stats', label: 'İstatistikler', icon: BarChart2 },
        ] as { key: 'general' | 'activity' | 'stats'; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key ? 'border-primary text-primary-light' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tab: General */}
      {tab === 'general' && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted mb-1">Kullanıcı Adı</div>
              <div className="font-mono text-sm text-slate-200">{user.username}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Durum</div>
              <StatusBadge status={user.status} />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Rol</div>
              <span className="badge bg-primary/10 text-primary-light">{user.role}</span>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Maks Bağlantı</div>
              <div className="text-sm text-slate-200 font-semibold">{user.maxConnections}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Başlangıç</div>
              <div className="text-sm text-slate-300">{formatDate(user.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Bitiş</div>
              <div className="text-sm text-slate-300">{formatDate(user.expiresAt)}</div>
              <div className={cn('text-xs mt-0.5', days < 7 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-muted')}>
                {days < 0 ? 'Süresi doldu' : `${days} gün kaldı`}
              </div>
            </div>
          </div>

          {user.notes && (
            <div>
              <div className="text-xs text-muted mb-1">Notlar</div>
              <div className="text-sm text-slate-300 bg-surface-2 rounded-lg p-2">{user.notes}</div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="text-xs text-muted mb-2">Şifre</div>
            {!editPassword ? (
              <button onClick={() => setEditPassword(true)} className="btn-secondary text-sm flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> Şifre Değiştir
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  className="input flex-1"
                  placeholder="Yeni şifre"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <button
                  className="btn-primary text-sm"
                  onClick={() => {
                    if (newPassword.length >= 4) {
                      onUpdate(userId, { password: newPassword });
                      setEditPassword(false);
                      setNewPassword('');
                    } else {
                      toast.error('Şifre en az 4 karakter olmalı');
                    }
                  }}
                >
                  Kaydet
                </button>
                <button className="btn-ghost text-sm" onClick={() => { setEditPassword(false); setNewPassword(''); }}>
                  İptal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
          {activityLoading && <p className="text-muted text-sm text-center py-6">Yükleniyor…</p>}
          {!activityLoading && (!activityData?.items || activityData.items.length === 0) && (
            <p className="text-muted text-sm text-center py-6">Aktivite kaydı yok</p>
          )}
          {activityData?.items.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-border/30">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', ACTION_BADGE[log.action] ?? 'bg-surface-2 text-muted')}>
                {log.action}
              </span>
              <div className="flex-1 min-w-0">
                {log.ip && <span className="font-mono text-xs text-muted mr-2">{log.ip}</span>}
                {log.userAgent && <span className="text-xs text-muted truncate block max-w-xs">{log.userAgent}</span>}
                {log.streamId && <span className="text-xs text-muted">Stream: {log.streamId.slice(0, 8)}…</span>}
              </div>
              <span className="text-xs text-muted flex-shrink-0">{new Date(log.createdAt).toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Stats */}
      {tab === 'stats' && (
        <div className="p-5">
          {statsLoading && <p className="text-muted text-sm text-center py-6">Yükleniyor…</p>}
          {stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{formatWatchTime(stats.totalWatchSeconds)}</div>
                  <div className="text-xs text-muted mt-1">Toplam İzleme</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-success">{stats.thisMonthConnections}</div>
                  <div className="text-xs text-muted mt-1">Bu Ay</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-slate-400">{stats.lastMonthConnections}</div>
                  <div className="text-xs text-muted mt-1">Geçen Ay</div>
                </div>
              </div>

              {stats.topChannels.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-300 mb-3">En Çok İzlenen 5 Kanal</div>
                  <div className="space-y-2">
                    {stats.topChannels.map((ch, i) => (
                      <div key={ch.streamId} className="flex items-center gap-3 py-2 border-b border-border/30">
                        <span className="text-xs text-muted w-4 text-center">{i + 1}</span>
                        {ch.tvgLogo && (
                          <img src={ch.tvgLogo} alt="" className="w-6 h-6 object-contain rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="flex-1 text-sm text-slate-300 truncate">{ch.name}</span>
                        <span className="text-xs text-muted font-mono">{ch.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const ACTION_BADGE: Record<string, string> = {
  LOGIN: 'bg-primary/20 text-primary',
  STREAM_START: 'bg-success/20 text-success',
  STREAM_STOP: 'bg-danger/20 text-danger',
  PASSWORD_CHANGE: 'bg-warning/20 text-warning',
};

function ActivityModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useUserActivity(userId);

  return (
    <Modal open onClose={onClose} title="Kullanıcı Aktivitesi" size="lg">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading && <p className="text-muted text-sm text-center py-6">Yükleniyor…</p>}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-muted text-sm text-center py-6">Aktivite kaydı yok</p>
        )}
        {data?.items.map((log) => (
          <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-border/30">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', ACTION_BADGE[log.action] ?? 'bg-surface-2 text-muted')}>
              {log.action}
            </span>
            <div className="flex-1 min-w-0">
              {log.ip && <span className="font-mono text-xs text-muted mr-2">{log.ip}</span>}
              {log.streamId && <span className="text-xs text-muted">Stream: {log.streamId.slice(0, 8)}…</span>}
            </div>
            <span className="text-xs text-muted flex-shrink-0">{new Date(log.createdAt).toLocaleString('tr-TR')}</span>
          </div>
        ))}
      </div>
    </Modal>
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
