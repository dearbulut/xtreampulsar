import { useState, useCallback } from 'react';
import { Plus, Search, Copy, Check, Clock, Wifi, Ban, Trash2, Pencil, QrCode, Download, RefreshCw, Activity, SlidersHorizontal, ChevronDown, ChevronUp, BarChart2, User as UserIcon, Timer, Database, Globe, Monitor, Smartphone, Tv, ChevronLeft, ChevronRight, Key, UserCheck, UserX, Shield, Hash, X, Zap, Shuffle, Link, ListVideo, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import type { ActivityFilters } from '@/hooks/useUserActivity';
import { useBulkAction } from '@/hooks/useBulkAction';
import type { BulkActionResult } from '@/hooks/useBulkAction';
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
  useKickUser, useDeleteUser, useUpdateUser, useQuickCreateUser, useCreateTrialUser,
  useUserBouquets,
} from '@/hooks/useUsers';
import { useSettings } from '@/hooks/useSettings';
import type { QuickCreateResult, TrialCreateResult } from '@/hooks/useUsers';
import { useBulkRenew } from '@/hooks/useBulkRenew';
import { usePackages } from '@/hooks/usePackages';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useBouquets } from '@/hooks/useBouquets';
import type { User } from '@/types';
import { daysLeft, formatDate, cn } from '@/lib/utils';

interface UserStats {
  totalDurationSeconds: number;
  totalBytesTransferred: string;
  lastActivity: { createdAt: string; action: string; streamId: string | null; country: string | null; deviceType: string | null } | null;
  deviceBreakdown: Record<string, number>;
  actionBreakdown: Record<string, number>;
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)}s ${m % 60}dk`;
  return m > 0 ? `${m}dk ${s}s` : `${s}s`;
}

const DEVICE_ICON: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tv: Tv,
  unknown: Monitor,
};

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
  const [kickId, setKickId] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [qrUserId, setQrUserId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ qrCodeImage: string; serverUrl: string; username: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [createForm, setCreateForm] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return { username: '', password: '', maxConnections: 1, expiresAt: d.toISOString().split('T')[0], notes: '', bouquetIds: [] as string[], packageId: '' };
  });
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Bulk renew (existing)
  const [showBulkRenew, setShowBulkRenew] = useState(false);
  const [bulkPackageId, setBulkPackageId] = useState('');
  // Bulk action (new)
  const [bulkActionType, setBulkActionType] = useState<string | null>(null);
  const [bulkValueInput, setBulkValueInput] = useState('');
  const [bulkPasswordResults, setBulkPasswordResults] = useState<BulkActionResult['results']>(undefined);

  const [activityUserId, setActivityUserId] = useState<string | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showTrialCreate, setShowTrialCreate] = useState(false);
  const [isTrial, setIsTrial] = useState(() => getParam('isTrial') === 'true' ? true : undefined as boolean | undefined);

  const { data, isLoading } = useUsers({ page, limit: 25, search, status, resellerId: resellerId || undefined, packageId: packageId || undefined, isTrial });
  const { data: bouquets = [] } = useBouquets();
  const { data: packages = [] } = usePackages();
  const { data: resellers = [] } = useResellers();
  const qc = useQueryClient();
  const bulkRenew = useBulkRenew();
  const bulkActionMut = useBulkAction();
  const createUser = useCreateUser();
  const quickCreateUser = useQuickCreateUser();
  const trialCreateUser = useCreateTrialUser();
  const extendUser = useExtendUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const kickUser = useKickUser();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();

  const handleSelectId = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleSelectAll = () => {
    const items = data?.items ?? [];
    const allSelected = items.length > 0 && items.every((u) => selectedIds.has(u.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) { items.forEach((u) => next.delete(u.id)); }
      else { items.forEach((u) => next.add(u.id)); }
      return next;
    });
  };

  const executeBulkAction = async (action: string, value?: string | number) => {
    try {
      const result = await bulkActionMut.mutateAsync({ action, userIds: [...selectedIds], value });
      if (action === 'reset-password' && result.results) {
        setBulkPasswordResults(result.results);
      } else {
        toast.success(`${result.affected} kullanıcı güncellendi`);
      }
      setBulkActionType(null);
      setBulkValueInput('');
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ['users'] });
    } catch { /* handled by mutation onError */ }
  };

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
      key: 'username',
      header: 'Kullanıcı',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-slate-200 font-mono">{r.username}</span>
              {r.isTrial && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">TRIAL</span>
              )}
            </div>
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
          <ActionBtn icon={Pencil} title="Düzenle" color="text-muted" onClick={() => setDetailUserId(r.id)} />
          <ActionBtn icon={Wifi} title="Bağlantıları kes" color="text-warning"
            onClick={() => setKickId(r.id)} />
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
            <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5 text-sm" title="CSV İndir">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Rapor İndir</span>
            </button>
            <button onClick={() => setShowTrialCreate(true)} className="btn-secondary flex items-center gap-1.5 text-sm text-amber-300 border-amber-300/30 hover:border-amber-300/60">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">Trial Ekle</span>
            </button>
            <button onClick={() => setShowQuickCreate(true)} className="btn-secondary flex items-center gap-1.5 text-sm text-amber-400 border-amber-400/30 hover:border-amber-400/60">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Hızlı Ekle</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Kullanıcı Ekle</span>
            </button>
          </>
        }
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-3 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm font-semibold text-primary">{selectedIds.size} kullanıcı seçildi</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-muted hover:text-fg transition-colors" title="Seçimi temizle">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => { setBulkValueInput('30'); setBulkActionType('extend'); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Clock className="w-3 h-3" /> Uzat
            </button>
            <button onClick={() => setBulkActionType('suspend')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-warning/10 hover:bg-warning/20 text-warning transition-colors">
              <Shield className="w-3 h-3" /> Askıya Al
            </button>
            <button onClick={() => setBulkActionType('activate')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors">
              <UserCheck className="w-3 h-3" /> Aktifleştir
            </button>
            <button onClick={() => setBulkActionType('delete')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors">
              <UserX className="w-3 h-3" /> Sil
            </button>
            <button onClick={() => setBulkActionType('reset-password')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Key className="w-3 h-3" /> Şifre Sıfırla
            </button>
            <button onClick={() => { setBulkValueInput('1'); setBulkActionType('max-connections'); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Hash className="w-3 h-3" /> Max Bağlantı
            </button>
            <button onClick={() => setShowBulkRenew(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <RefreshCw className="w-3 h-3" /> Paket Yenile
            </button>
          </div>
        </div>
      )}

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
            <select
              className="input h-9 w-auto min-w-40"
              value={isTrial === true ? 'true' : isTrial === false ? 'false' : ''}
              onChange={(e) => {
                const v = e.target.value;
                const next = v === 'true' ? true : v === 'false' ? false : undefined;
                setIsTrial(next);
                setParam('isTrial', v);
                setPage(1);
              }}
            >
              <option value="">Tüm Hesaplar</option>
              <option value="true">Trial Hesaplar</option>
              <option value="false">Normal Hesaplar</option>
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
          selectedIds={selectedIds}
          onSelectId={handleSelectId}
          onSelectAll={handleSelectAll}
          emptyTitle="Kullanıcı bulunamadı"
          emptyDescription="Arama kriterlerinize uygun kullanıcı yok."
        />
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Kullanıcı" size="md">
        <div className="space-y-4">
          {/* Package selector */}
          {packages.length > 0 && (
            <div>
              <label className="label">Paket</label>
              <select
                className="input"
                value={createForm.packageId}
                onChange={(e) => {
                  const pkg = packages.find((p) => p.id === e.target.value);
                  if (pkg) {
                    const expDate = new Date();
                    expDate.setDate(expDate.getDate() + pkg.durationDays);
                    const local = expDate.toISOString().split('T')[0];
                    setCreateForm((f) => ({
                      ...f,
                      packageId: pkg.id,
                      maxConnections: pkg.maxConnections,
                      expiresAt: local,
                    }));
                  } else {
                    setCreateForm((f) => ({ ...f, packageId: '' }));
                  }
                }}
              >
                <option value="">Paket seçin (isteğe bağlı)…</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.durationDays}g / {p.maxConnections} bağlantı / {p.creditCost} kredi
                  </option>
                ))}
              </select>
              {createForm.packageId && (() => {
                const pkg = packages.find((p) => p.id === createForm.packageId);
                return pkg ? (
                  <p className="text-xs text-warning mt-1">Bu kullanıcı {pkg.creditCost} kredi harcayacak</p>
                ) : null;
              })()}
            </div>
          )}
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
              <input className="input" type="number" min={1} max={100}
                value={createForm.maxConnections}
                onChange={(e) => setCreateForm((f) => ({ ...f, maxConnections: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="label">Son Tarih</label>
              <input className="input" type="date"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notlar (isteğe bağlı)</label>
            <textarea className="input min-h-[60px] resize-none" placeholder="Not ekle…"
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
              {createForm.bouquetIds.length === 0 && (() => {
                const pkg = packages.find((p) => p.id === createForm.packageId);
                const pkgBouquets = pkg?.bouquets ?? [];
                if (pkg && pkgBouquets.length > 0) {
                  return (
                    <p className="text-xs text-info mt-1.5">
                      Bu paket şu bouquet'leri içerir: {pkgBouquets.map((b) => b.name).join(', ')}
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-muted mt-1.5">
                    Hiçbir şey seçilmezse kullanıcıya varsayılan bouquet atanır (playlist boş kalmaz).
                  </p>
                );
              })()}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">İptal</button>
            <button
              disabled={createUser.isPending}
              onClick={() => {
                if (createForm.username && createForm.password) {
                  const { bouquetIds, packageId: pkgId, ...rest } = createForm;
                  const expiresAt = createForm.expiresAt
                    ? new Date(createForm.expiresAt).toISOString()
                    : undefined;
                  createUser.mutate(
                    {
                      ...rest,
                      ...(expiresAt ? { expiresAt } : {}),
                      ...(pkgId ? { packageId: pkgId } : {}),
                      ...(bouquetIds.length > 0 ? { bouquetIds } : {}),
                    } as Parameters<typeof createUser.mutate>[0],
                    { onSuccess: () => { setShowCreate(false); const d2 = new Date(); d2.setDate(d2.getDate() + 30); setCreateForm({ username: '', password: '', maxConnections: 1, expiresAt: d2.toISOString().split('T')[0], notes: '', bouquetIds: [], packageId: '' }); } },
                  );
                } else {
                  toast.error('Kullanıcı adı ve şifre zorunludur');
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

      <ConfirmDialog
        open={!!kickId}
        onClose={() => setKickId(null)}
        onConfirm={() => { if (kickId) kickUser.mutate(kickId, { onSuccess: () => setKickId(null) }); }}
        title="Bağlantıları Kes"
        message="Bu kullanıcının tüm aktif bağlantıları kesilecek (hesap kapatılmaz)."
        confirmLabel="Bağlantıları Kes"
        loading={kickUser.isPending}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title="Kullanıcıyı Sil"
        message="Bu kullanıcı devre dışı bırakılacak (DISABLED). Gerçek silme yapılmaz."
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

      {/* Bulk: Askıya Al */}
      <ConfirmDialog
        open={bulkActionType === 'suspend'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('suspend')}
        title={`${selectedIds.size} Kullanıcıyı Askıya Al`}
        message="Seçilen kullanıcılar yasaklanacak (BANNED). Aktif bağlantıları kesilmeyecek."
        confirmLabel="Askıya Al"
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Aktifleştir */}
      <ConfirmDialog
        open={bulkActionType === 'activate'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('activate')}
        title={`${selectedIds.size} Kullanıcıyı Aktifleştir`}
        message="Seçilen kullanıcıların durumu ACTIVE yapılacak."
        confirmLabel="Aktifleştir"
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Sil */}
      <ConfirmDialog
        open={bulkActionType === 'delete'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('delete')}
        title={`${selectedIds.size} Kullanıcıyı Sil`}
        message="Seçilen kullanıcılar devre dışı bırakılacak (DISABLED). Gerçek silme yapılmaz."
        confirmLabel="Sil"
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Şifre Sıfırla — onay */}
      <ConfirmDialog
        open={bulkActionType === 'reset-password'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('reset-password')}
        title={`${selectedIds.size} Kullanıcının Şifresini Sıfırla`}
        message="Her kullanıcı için rastgele 8 karakterlik yeni şifre üretilecek. Mevcut şifreler geçersiz olacak."
        confirmLabel="Sıfırla"
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Uzat */}
      <Modal open={bulkActionType === 'extend'} onClose={() => setBulkActionType(null)} title={`${selectedIds.size} Kullanıcı Süresini Uzat`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Kaç gün uzatılsın?</label>
            <input type="number" min={1} max={3650} className="input"
              value={bulkValueInput}
              onChange={(e) => setBulkValueInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setBulkActionType(null)}>İptal</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!bulkValueInput || parseInt(bulkValueInput) < 1 || bulkActionMut.isPending}
              onClick={() => void executeBulkAction('extend', parseInt(bulkValueInput))}
            >
              <Clock className="w-4 h-4" />
              {bulkActionMut.isPending ? 'Uzatılıyor…' : 'Uzat'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk: Max Bağlantı */}
      <Modal open={bulkActionType === 'max-connections'} onClose={() => setBulkActionType(null)} title={`${selectedIds.size} Kullanıcı Maks. Bağlantı`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Yeni maks. bağlantı sayısı</label>
            <input type="number" min={1} max={100} className="input"
              value={bulkValueInput}
              onChange={(e) => setBulkValueInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setBulkActionType(null)}>İptal</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!bulkValueInput || parseInt(bulkValueInput) < 1 || bulkActionMut.isPending}
              onClick={() => void executeBulkAction('max-connections', parseInt(bulkValueInput))}
            >
              <Hash className="w-4 h-4" />
              {bulkActionMut.isPending ? 'Uygulanıyor…' : 'Uygula'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk: Şifre Sıfırlama Sonuçları */}
      <Modal open={!!bulkPasswordResults} onClose={() => setBulkPasswordResults(undefined)} title="Yeni Şifreler" size="md">
        {bulkPasswordResults && (
          <div className="space-y-3">
            <p className="text-xs text-warning">Bu şifreler bir daha görüntülenemez. Şimdi kopyalayın veya not alın.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted font-medium text-xs">Kullanıcı</th>
                    <th className="text-left py-2 text-muted font-medium text-xs">Yeni Şifre</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {bulkPasswordResults.map((r) => (
                    <tr key={r.userId} className="border-b border-border/30">
                      <td className="py-2 font-mono text-slate-200">{r.username}</td>
                      <td className="py-2 font-mono text-primary">{r.newPassword}</td>
                      <td className="py-2">
                        <button
                          className="text-muted hover:text-slate-200 transition-colors p-1"
                          title="Kopyala"
                          onClick={() => {
                            void navigator.clipboard.writeText(r.newPassword);
                            toast.success(`${r.username} şifresi kopyalandı`);
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                className="btn-secondary text-sm flex items-center gap-2"
                onClick={() => {
                  const text = bulkPasswordResults.map((r) => `${r.username}\t${r.newPassword}`).join('\n');
                  void navigator.clipboard.writeText(text);
                  toast.success('Tümü kopyalandı');
                }}
              >
                <Copy className="w-3.5 h-3.5" /> Tümünü Kopyala
              </button>
              <button className="btn-primary text-sm" onClick={() => setBulkPasswordResults(undefined)}>Kapat</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hızlı Ekle Modal */}
      {showQuickCreate && (
        <QuickCreateModal
          onClose={() => setShowQuickCreate(false)}
          mutation={quickCreateUser}
        />
      )}

      {/* Trial Ekle Modal */}
      {showTrialCreate && (
        <TrialCreateModal
          onClose={() => setShowTrialCreate(false)}
          mutation={trialCreateUser}
        />
      )}

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
  const [tab, setTab] = useState<'general' | 'activity' | 'stats' | 'playlists'>('general');
  const [editPassword, setEditPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [activityFilters, setActivityFilters] = useState<ActivityFilters>({});
  const [filterDraft, setFilterDraft] = useState({ startDate: '', endDate: '', action: '' });

  const { data: activityData, isLoading: activityLoading } = useUserActivity(userId, activityPage, 50, activityFilters);
  const { data: stats, isLoading: statsLoading } = useUserStats(userId);
  const { data: userBouquets = [] } = useUserBouquets(userId);
  const { data: allBouquets = [] } = useBouquets();
  const [editingBouquets, setEditingBouquets] = useState(false);
  const [bouquetDraft, setBouquetDraft] = useState<string[]>([]);
  const kickUser = useKickUser();

  if (!user) return null;

  const days = daysLeft(user.expiresAt);

  return (
    <Modal open onClose={onClose} title={`Kullanıcı: ${user.username}`} size="lg">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: 'general',   label: 'Genel',        icon: UserIcon },
          { key: 'playlists', label: "Playlist'ler",  icon: ListVideo },
          { key: 'activity',  label: 'Aktivite',      icon: Activity },
          { key: 'stats',     label: 'İstatistikler', icon: BarChart2 },
        ] as { key: 'general' | 'activity' | 'stats' | 'playlists'; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
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
              <div className="text-xs text-muted mb-1">Bağlantı (aktif / maks)</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-semibold">
                  {user._count?.connections ?? 0} / {user.maxConnections}
                </span>
                {(user._count?.connections ?? 0) > 0 && (
                  <button
                    onClick={() => kickUser.mutate(user.id)}
                    disabled={kickUser.isPending}
                    className="text-[11px] px-2 py-0.5 rounded bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-50"
                    title="Aktif bağlantıları kes"
                  >
                    Bağlantıları Kes
                  </button>
                )}
              </div>
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

          {/* Bouquet'ler — görünürlük + düzenleme */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted">Bouquet'ler</div>
              {!editingBouquets && (
                <button
                  onClick={() => { setBouquetDraft(userBouquets.map((b) => b.id)); setEditingBouquets(true); }}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> Düzenle
                </button>
              )}
            </div>

            {!editingBouquets ? (
              userBouquets.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {userBouquets.map((b) => (
                    <span key={b.id} className="badge bg-primary/10 text-primary-light">{b.name}</span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-danger bg-danger/10 rounded-lg p-2">
                  Bouquet atanmamış — bu kullanıcı hiçbir kanal göremez.
                </div>
              )
            ) : (
              <div className="space-y-2">
                <MultiSelect
                  options={allBouquets.map((b) => ({ value: b.id, label: b.name }))}
                  value={bouquetDraft}
                  onChange={setBouquetDraft}
                  placeholder="Bouquet seçin…"
                />
                {bouquetDraft.length === 0 && (
                  <p className="text-xs text-warning">Uyarı: boş bırakılırsa kullanıcı hiçbir kanal göremez.</p>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => { onUpdate(userId, { bouquetIds: bouquetDraft }); setEditingBouquets(false); }}
                  >
                    Kaydet
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => setEditingBouquets(false)}>İptal</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Stat cards */}
          {statsLoading && <div className="grid grid-cols-4 gap-3"><div className="card p-4 col-span-4 text-center text-muted text-sm">Yükleniyor…</div></div>}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Timer className="w-4 h-4 text-primary mb-0.5" />
                <div className="text-lg font-bold text-slate-100">{formatWatchTime(stats.totalDurationSeconds)}</div>
                <div className="text-[11px] text-muted">Toplam İzleme</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Database className="w-4 h-4 text-success mb-0.5" />
                <div className="text-lg font-bold text-slate-100">{formatBytes(Number(stats.totalBytesTransferred))}</div>
                <div className="text-[11px] text-muted">Toplam Veri</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Clock className="w-4 h-4 text-warning mb-0.5" />
                <div className="text-sm font-semibold text-slate-100 leading-tight">
                  {stats.lastActivity ? new Date(stats.lastActivity.createdAt).toLocaleDateString('tr-TR') : '-'}
                </div>
                <div className="text-[11px] text-muted">Son Aktivite</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                {(() => {
                  const topDevice = Object.entries(stats.deviceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
                  const Icon = DEVICE_ICON[topDevice] ?? Monitor;
                  return (
                    <>
                      <Icon className="w-4 h-4 text-slate-400 mb-0.5" />
                      <div className="text-sm font-semibold text-slate-100 capitalize">{topDevice}</div>
                      <div className="text-[11px] text-muted">Ana Cihaz</div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <div className="text-[11px] text-muted mb-1">Başlangıç</div>
              <input
                type="date"
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.startDate}
                onChange={(e) => setFilterDraft((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-[11px] text-muted mb-1">Bitiş</div>
              <input
                type="date"
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.endDate}
                onChange={(e) => setFilterDraft((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-[11px] text-muted mb-1">Aksiyon</div>
              <select
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.action}
                onChange={(e) => setFilterDraft((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="">Tümü</option>
                {['LOGIN', 'STREAM_START', 'STREAM_STOP', 'PASSWORD_CHANGE'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary text-xs px-3 h-8"
              onClick={() => {
                setActivityPage(1);
                setActivityFilters({
                  startDate: filterDraft.startDate || undefined,
                  endDate: filterDraft.endDate || undefined,
                  action: filterDraft.action || undefined,
                });
              }}
            >
              Filtrele
            </button>
            {(activityFilters.startDate || activityFilters.endDate || activityFilters.action) && (
              <button
                className="btn-ghost text-xs px-3 h-8"
                onClick={() => { setFilterDraft({ startDate: '', endDate: '', action: '' }); setActivityFilters({}); setActivityPage(1); }}
              >
                Temizle
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="text-left py-2 px-2 font-medium">Tarih/Saat</th>
                  <th className="text-left py-2 px-2 font-medium">Aksiyon</th>
                  <th className="text-left py-2 px-2 font-medium">IP</th>
                  <th className="text-left py-2 px-2 font-medium">Ülke</th>
                  <th className="text-left py-2 px-2 font-medium">Cihaz</th>
                  <th className="text-left py-2 px-2 font-medium">Süre</th>
                </tr>
              </thead>
              <tbody>
                {activityLoading && (
                  <tr><td colSpan={6} className="text-center text-muted py-8">Yükleniyor…</td></tr>
                )}
                {!activityLoading && (!activityData?.items || activityData.items.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-muted py-8">Kayıt bulunamadı</td></tr>
                )}
                {activityData?.items.map((log) => {
                  const DeviceIcon = DEVICE_ICON[log.deviceType ?? 'unknown'] ?? Monitor;
                  return (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-surface-2/40 transition-colors">
                      <td className="py-2 px-2 text-muted font-mono whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2 px-2">
                        <span className={cn('px-1.5 py-0.5 rounded font-medium', ACTION_BADGE[log.action] ?? 'bg-surface-2 text-muted')}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-muted">{log.ip ?? '-'}</td>
                      <td className="py-2 px-2 text-slate-300">{log.country ?? '-'}</td>
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-1 text-slate-400">
                          <DeviceIcon className="w-3 h-3" />
                          <span className="capitalize">{log.deviceType ?? '-'}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2 text-muted">{formatDuration(log.duration)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {activityData && activityData.totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted">
                {activityData.total} kayıt — Sayfa {activityData.page}/{activityData.totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  className="btn-ghost p-1.5 disabled:opacity-30"
                  disabled={activityPage === 1}
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="btn-ghost p-1.5 disabled:opacity-30"
                  disabled={activityPage >= activityData.totalPages}
                  onClick={() => setActivityPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Stats */}
      {tab === 'stats' && (
        <div className="p-5 space-y-5">
          {statsLoading && <p className="text-muted text-sm text-center py-6">Yükleniyor…</p>}
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4 text-center">
                  <div className="text-xl font-bold text-primary">{formatWatchTime(stats.totalDurationSeconds)}</div>
                  <div className="text-xs text-muted mt-1">Toplam İzleme</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-xl font-bold text-success">{formatBytes(Number(stats.totalBytesTransferred))}</div>
                  <div className="text-xs text-muted mt-1">Toplam Veri</div>
                </div>
              </div>

              {Object.keys(stats.actionBreakdown).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-300 mb-2">Aksiyon Dağılımı</div>
                  <div className="space-y-1.5">
                    {Object.entries(stats.actionBreakdown).map(([action, count]) => (
                      <div key={action} className="flex items-center gap-2">
                        <span className={cn('text-xs px-2 py-0.5 rounded font-medium w-36 text-center', ACTION_BADGE[action] ?? 'bg-surface-2 text-muted')}>
                          {action}
                        </span>
                        <div className="flex-1 bg-surface-2 rounded-full h-1.5">
                          <div
                            className="bg-primary/60 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.actionBreakdown))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted font-mono w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(stats.deviceBreakdown).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-300 mb-2">Cihaz Dağılımı</div>
                  <div className="flex gap-3 flex-wrap">
                    {Object.entries(stats.deviceBreakdown).map(([device, count]) => {
                      const Icon = DEVICE_ICON[device] ?? Monitor;
                      return (
                        <div key={device} className="card px-3 py-2 flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs capitalize text-slate-300">{device}</span>
                          <span className="text-xs font-bold text-primary">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stats.lastActivity && (
                <div className="card p-3">
                  <div className="text-xs text-muted mb-1">Son Aktivite</div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', ACTION_BADGE[stats.lastActivity.action] ?? 'bg-surface-2 text-muted')}>
                      {stats.lastActivity.action}
                    </span>
                    <span className="text-xs text-muted">{new Date(stats.lastActivity.createdAt).toLocaleString('tr-TR')}</span>
                    {stats.lastActivity.country && (
                      <span className="flex items-center gap-1 text-xs text-muted ml-auto">
                        <Globe className="w-3 h-3" />{stats.lastActivity.country}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Playlists */}
      {tab === 'playlists' && (
        <PlaylistTab userId={userId} username={user.username} />
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

// ─── Playlist Tab ────────────────────────────────────────────────────────────

interface UserPlaylist {
  id: string;
  name: string;
  token: string;
  type: string;
  filters: { onlyLive?: boolean; onlyVod?: boolean } | null;
  isActive: boolean;
  expiresAt: string | null;
  lastAccessed: string | null;
  accessCount: number;
  createdAt: string;
}

function useUserPlaylists(userId: string) {
  return useQuery<UserPlaylist[]>({
    queryKey: ['user-playlists', userId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: UserPlaylist[] }>(`/users/${userId}/playlists`);
      return res.data.data;
    },
  });
}

const TYPE_LABELS: Record<string, string> = { m3u_plus: 'M3U+', m3u: 'M3U', ts: 'TS', rtmp: 'RTMP' };
const TYPE_COLORS: Record<string, string> = { m3u_plus: 'bg-primary/20 text-primary', m3u: 'bg-info/20 text-info', ts: 'bg-warning/20 text-warning', rtmp: 'bg-success/20 text-success' };

function getServerUrl(): string {
  return window.location.origin;
}

function PlaylistTab({ userId, username }: { userId: string; username: string }) {
  const qc = useQueryClient();
  const { data: playlists = [], isLoading } = useUserPlaylists(userId);
  const settings = useSettings();
  const xtreamBaseUrl = (() => {
    const rawUrl = settings?.general?.serverUrl?.trim();
    const port = settings?.xtream?.port ?? 25461;
    if (rawUrl) {
      // strip any trailing slash and protocol, always use http for Xtream port
      const host = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
      return `http://${host}:${port}`;
    }
    return `http://${window.location.hostname}:${port}`;
  })();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyUrl = (token: string) => {
    const url = `${getServerUrl()}/playlist/${token}`;
    void navigator.clipboard.writeText(url);
    setCopiedKey(`token:${token}`);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Playlist URL kopyalandı');
  };

  const copyStdUrl = (token: string) => {
    const url = `${xtreamBaseUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(token)}&type=m3u_plus`;
    void navigator.clipboard.writeText(url);
    setCopiedKey(`std:${token}`);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Standart URL kopyalandı');
  };

  const toggleActive = async (pl: UserPlaylist) => {
    await api.put(`/users/playlists/${pl.id}`, { isActive: !pl.isActive });
    void qc.invalidateQueries({ queryKey: ['user-playlists', userId] });
  };

  const deletePl = async (id: string) => {
    await api.delete(`/users/playlists/${id}`);
    void qc.invalidateQueries({ queryKey: ['user-playlists', userId] });
    toast.success('Playlist silindi');
  };

  const editing = editingId ? playlists.find((p) => p.id === editingId) ?? null : null;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{playlists.length} playlist</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Yeni Playlist
        </button>
      </div>

      {isLoading && <p className="text-center text-muted text-sm py-6">Yükleniyor…</p>}
      {!isLoading && playlists.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-muted">
          <ListVideo className="w-10 h-10 opacity-30" />
          <p className="text-sm">Henüz playlist yok</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
        {playlists.map((pl) => {
          const url = `${getServerUrl()}/playlist/${pl.token}`;
          return (
            <div key={pl.id} className={cn('card p-4 space-y-2.5', !pl.isActive && 'opacity-50')}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-fg truncate">{pl.name}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', TYPE_COLORS[pl.type] ?? 'bg-surface-2 text-muted')}>
                  {TYPE_LABELS[pl.type] ?? pl.type}
                </span>
              </div>

              {/* Token URL */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Token URL</span>
                <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-muted font-mono truncate flex-1">{url}</span>
                  <button onClick={() => copyUrl(pl.token)} className="text-muted hover:text-fg shrink-0 transition-colors" title="Kopyala">
                    {copiedKey === `token:${pl.token}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="text-muted hover:text-fg shrink-0 transition-colors" title="Aç">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Standard Xtream URL */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Standart</span>
                <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-muted font-mono truncate flex-1">
                    {`${xtreamBaseUrl}/get.php?username=${encodeURIComponent(username)}&password=***&type=m3u_plus`}
                  </span>
                  <button onClick={() => copyStdUrl(pl.token)} className="text-muted hover:text-fg shrink-0 transition-colors" title="Standart URL Kopyala">
                    {copiedKey === `std:${pl.token}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Filters summary */}
              {pl.filters && (pl.filters.onlyLive || pl.filters.onlyVod) && (
                <p className="text-[11px] text-muted">
                  Filtre: {pl.filters.onlyLive ? 'Sadece Canlı' : 'Sadece VOD'}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span>{pl.accessCount} erişim</span>
                {pl.lastAccessed && <span>Son: {new Date(pl.lastAccessed).toLocaleDateString('tr-TR')}</span>}
                {pl.expiresAt && <span className="text-warning">Bitiş: {new Date(pl.expiresAt).toLocaleDateString('tr-TR')}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                <button
                  onClick={() => void toggleActive(pl)}
                  className={cn('flex items-center gap-1 text-[11px] transition-colors', pl.isActive ? 'text-success' : 'text-muted')}
                  title={pl.isActive ? 'Pasif yap' : 'Aktif yap'}
                >
                  {pl.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {pl.isActive ? 'Aktif' : 'Pasif'}
                </button>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditingId(pl.id)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-fg transition-colors" title="Düzenle">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => void deletePl(pl.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted hover:text-danger transition-colors" title="Sil">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit modal */}
      {(showCreate || editing) && (
        <PlaylistFormModal
          userId={userId}
          existing={editing}
          onClose={() => { setShowCreate(false); setEditingId(null); }}
          onSaved={() => { setShowCreate(false); setEditingId(null); void qc.invalidateQueries({ queryKey: ['user-playlists', userId] }); }}
        />
      )}
    </div>
  );
}

interface PlaylistFormModalProps {
  userId: string;
  existing: UserPlaylist | null;
  onClose: () => void;
  onSaved: () => void;
}

function PlaylistFormModal({ userId, existing, onClose, onSaved }: PlaylistFormModalProps) {
  const [name, setName]       = useState(existing?.name ?? '');
  const [type, setType]       = useState(existing?.type ?? 'm3u_plus');
  const [filter, setFilter]   = useState<'all' | 'live' | 'vod'>(
    existing?.filters?.onlyLive ? 'live' : existing?.filters?.onlyVod ? 'vod' : 'all',
  );
  const [expiry, setExpiry]   = useState<'unlimited' | 'date'>('unlimited');
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt?.slice(0, 10) ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error('İsim zorunlu'); return; }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        type,
        filters: filter === 'all' ? null : { onlyLive: filter === 'live', onlyVod: filter === 'vod' },
        expiresAt: expiry === 'date' && expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (existing) {
        await api.put(`/users/playlists/${existing.id}`, body);
        toast.success('Playlist güncellendi');
      } else {
        await api.post(`/users/${userId}/playlists`, body);
        toast.success('Playlist oluşturuldu');
      }
      onSaved();
    } catch {
      toast.error('Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? 'Playlist Düzenle' : 'Yeni Playlist'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">İsim</label>
          <input className="input" placeholder="Ana Liste, TV vb." value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="label">Tip</label>
          <div className="flex gap-1.5">
            {[['m3u_plus', 'M3U+'], ['m3u', 'M3U'], ['ts', 'TS']] .map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => setType(v)}
                className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', type === v ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">İçerik Filtresi</label>
          <div className="flex gap-1.5">
            {[['all', 'Tümü'], ['live', 'Sadece Canlı'], ['vod', 'Sadece VOD']] .map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => setFilter(v as 'all' | 'live' | 'vod')}
                className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', filter === v ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Geçerlilik</label>
          <div className="flex gap-1.5 mb-2">
            {[['unlimited', 'Sınırsız'], ['date', 'Tarih Seç']] .map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => setExpiry(v as 'unlimited' | 'date')}
                className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', expiry === v ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                {lbl}
              </button>
            ))}
          </div>
          {expiry === 'date' && (
            <input type="date" className="input text-sm" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">İptal</button>
          <button type="button" onClick={() => void handleSave()} disabled={loading} className="btn-primary">
            {loading ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Hızlı Ekle Modal ────────────────────────────────────────────────────────

function randomStr(len = 8): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const TEST_PRESETS = [
  { label: '1 Saat',  hours: 1 },
  { label: '3 Saat',  hours: 3 },
  { label: '6 Saat',  hours: 6 },
  { label: '12 Saat', hours: 12 },
  { label: '24 Saat', hours: 24 },
] as const;

const STANDARD_PRESETS = [
  { label: '1 Ay',  days: 30 },
  { label: '3 Ay',  days: 90 },
  { label: '6 Ay',  days: 180 },
  { label: '9 Ay',  days: 270 },
  { label: '1 Yıl', days: 365 },
  { label: '2 Yıl', days: 730 },
] as const;

const CONN_PRESETS = [1, 2, 3, 5] as const;

interface QuickCreateModalProps {
  onClose: () => void;
  mutation: ReturnType<typeof useQuickCreateUser>;
}

// preset key: `h:N` for hours, `d:N` for days, `custom` for custom days
type DurationKey = `h:${number}` | `d:${number}` | 'custom';

function QuickCreateModal({ onClose, mutation }: QuickCreateModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [durationKey, setDurationKey] = useState<DurationKey>('d:30');
  const [customDays, setCustomDays] = useState('');
  const [maxConns, setMaxConns] = useState(1);
  const [customConns, setCustomConns] = useState('');
  const [connsPreset, setConnsPreset] = useState<number | 'custom'>(1);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<QuickCreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveConns = connsPreset === 'custom' ? (parseInt(customConns) || 1) : connsPreset;

  const expiresLabel = (() => {
    if (durationKey === 'custom') {
      const days = parseInt(customDays) || 30;
      return new Date(Date.now() + days * 86_400_000).toLocaleDateString('tr-TR');
    }
    const [type, val] = durationKey.split(':');
    const ms = type === 'h' ? Number(val) * 3_600_000 : Number(val) * 86_400_000;
    return new Date(Date.now() + ms).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  })();

  async function handleCreate() {
    let payload: { durationDays?: number; durationHours?: number } = {};
    if (durationKey === 'custom') {
      payload = { durationDays: parseInt(customDays) || 30 };
    } else {
      const [type, val] = durationKey.split(':');
      if (type === 'h') payload = { durationHours: Number(val) };
      else payload = { durationDays: Number(val) };
    }
    const data = await mutation.mutateAsync({
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      ...payload,
      maxConnections: effectiveConns,
      notes: notes.trim() || undefined,
    });
    setResult(data);
  }

  function handleCopy() {
    if (!result) return;
    const text = [
      `Kullanıcı Adı: ${result.user.username}`,
      `Şifre: ${result.user.password}`,
      `Bitiş: ${new Date(result.user.expiresAt).toLocaleDateString('tr-TR')}`,
      `M3U URL: ${result.m3uUrl}`,
    ].join('\n');
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Bilgiler panoya kopyalandı');
  }

  function handleReset() {
    setUsername('');
    setPassword('');
    setDurationKey('d:30');
    setCustomDays('');
    setMaxConns(1);
    setCustomConns('');
    setConnsPreset(1);
    setNotes('');
    setResult(null);
    setCopied(false);
  }

  return (
    <Modal open onClose={onClose} title="Hızlı Kullanıcı Oluştur" size="sm">
      {!result ? (
        <div className="space-y-4">
          {/* Kullanıcı adı */}
          <div>
            <label className="label">Kullanıcı Adı <span className="text-muted font-normal">(boş bırakılırsa otomatik)</span></label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="user123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost px-2.5 text-muted hover:text-fg"
                title="Rastgele üret"
                onClick={() => setUsername(randomStr(8))}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Şifre */}
          <div>
            <label className="label">Şifre <span className="text-muted font-normal">(boş bırakılırsa otomatik)</span></label>
            <div className="flex gap-2">
              <input
                className="input flex-1 font-mono"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost px-2.5 text-muted hover:text-fg"
                title="Rastgele üret"
                onClick={() => setPassword(randomStr(8))}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Süre */}
          <div className="space-y-2">
            <label className="label">Süre</label>

            {/* Test satırı */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Test</span>
              <div className="flex flex-wrap gap-1.5">
                {TEST_PRESETS.map(({ label, hours }) => {
                  const key: DurationKey = `h:${hours}`;
                  return (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setDurationKey(key)}
                      className={cn(
                        'px-2.5 py-1.5 text-xs rounded-lg transition-colors',
                        durationKey === key ? 'bg-amber-500 text-white' : 'bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standart satırı */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Standart</span>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_PRESETS.map(({ label, days }) => {
                  const key: DurationKey = `d:${days}`;
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDurationKey(key)}
                      className={cn(
                        'px-2.5 py-1.5 text-xs rounded-lg transition-colors',
                        durationKey === key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setDurationKey('custom')}
                  className={cn(
                    'px-2.5 py-1.5 text-xs rounded-lg transition-colors',
                    durationKey === 'custom' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  Özel
                </button>
              </div>
              {durationKey === 'custom' && (
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="input mt-1 w-32 text-sm"
                  placeholder="Gün sayısı"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <p className="text-xs text-muted">Bitiş: {expiresLabel}</p>
          </div>

          {/* Max Bağlantı */}
          <div>
            <label className="label">Maks. Bağlantı</label>
            <div className="flex flex-wrap gap-1.5">
              {CONN_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setConnsPreset(n); setMaxConns(n); }}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-lg transition-colors min-w-[36px]',
                    connsPreset === n ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setConnsPreset('custom')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-lg transition-colors',
                  connsPreset === 'custom' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg',
                )}
              >
                Özel
              </button>
            </div>
            {connsPreset === 'custom' && (
              <input
                type="number"
                min={1}
                max={100}
                className="input mt-2 w-24 text-sm"
                placeholder="Adet"
                value={customConns}
                onChange={(e) => setCustomConns(e.target.value)}
              />
            )}
          </div>

          {/* Notlar */}
          <div>
            <label className="label">Notlar <span className="text-muted font-normal">(isteğe bağlı)</span></label>
            <input
              className="input"
              placeholder="Müşteri adı, not vb."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">İptal</button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void handleCreate()}
              className="btn-primary flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {mutation.isPending ? 'Oluşturuluyor…' : 'Oluştur ve Kopyala'}
            </button>
          </div>
        </div>
      ) : (
        /* ─── Başarı kartı ─── */
        <div className="space-y-4">
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-success font-semibold text-sm">
              <Check className="w-4 h-4" /> Kullanıcı oluşturuldu
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted">Kullanıcı Adı</span>
              <span className="font-mono text-slate-200 font-medium">{result.user.username}</span>
              <span className="text-muted">Şifre</span>
              <span className="font-mono text-slate-200 font-medium">{result.user.password}</span>
              <span className="text-muted">Bitiş</span>
              <span className="text-slate-200">{new Date(result.user.expiresAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>

          <div className="rounded-xl bg-surface-2 border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <Link className="w-3.5 h-3.5" /> M3U URL
            </div>
            <p className="font-mono text-xs text-primary break-all leading-relaxed">{result.m3uUrl}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Kopyalandı!' : 'Kopyala'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Zap className="w-4 h-4" /> Yeni Hat
            </button>
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Kapat</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface TrialCreateModalProps {
  onClose: () => void;
  mutation: ReturnType<typeof useCreateTrialUser>;
}

function TrialCreateModal({ onClose, mutation }: TrialCreateModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [maxConnections, setMaxConnections] = useState(1);
  const [result, setResult] = useState<TrialCreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    mutation.mutate(
      { username: username || undefined, password: password || undefined, durationDays, maxConnections },
      { onSuccess: (res) => setResult(res) },
    );
  };

  if (result) {
    const text = `Kullanıcı Adı: ${result.user.username}\nŞifre: ${result.user.password}\nM3U URL: ${result.m3uUrl}`;
    return (
      <Modal open onClose={onClose} title="⏱ Trial Hesap Oluşturuldu" size="md">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted">Kullanıcı Adı</span>
              <span className="font-mono text-amber-300">{result.user.username}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Şifre</span>
              <span className="font-mono text-amber-300">{result.user.password}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Süre</span>
              <span className="font-mono">{new Date(result.user.expiresAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 border border-border p-3">
            <p className="text-xs text-muted mb-1">M3U URL</p>
            <p className="font-mono text-xs text-primary break-all">{result.m3uUrl}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-secondary text-sm flex-1"
            >
              {copied ? 'Kopyalandı!' : 'Kopyala'}
            </button>
            <button onClick={() => { setResult(null); setUsername(''); setPassword(''); }} className="btn-ghost text-sm">Yeni</button>
            <button onClick={onClose} className="btn-ghost text-sm">Kapat</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="⏱ Trial Hesap Ekle" size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Kullanıcı Adı <span className="text-muted text-xs">(boş bırakılırsa otomatik)</span></label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="trial_..." />
        </div>
        <div>
          <label className="label">Şifre <span className="text-muted text-xs">(boş bırakılırsa otomatik)</span></label>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Otomatik üretilir" />
        </div>
        <div>
          <label className="label">Süre</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDurationDays(d)}
                className={cn('py-2 rounded-lg text-sm font-medium border transition-colors', durationDays === d ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:text-fg hover:border-border/80')}
              >
                {d} Gün
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Max Bağlantı</label>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                onClick={() => setMaxConnections(n)}
                className={cn('py-2 rounded-lg text-sm font-medium border transition-colors', maxConnections === n ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:text-fg')}
              >
                {n} Bağlantı
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="btn-ghost">İptal</button>
          <button onClick={handleCreate} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>
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
