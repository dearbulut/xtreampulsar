import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Copy, Check, Clock, Wifi, Ban, Trash2, Pencil, QrCode, Download, RefreshCw, Activity, SlidersHorizontal, ChevronDown, ChevronUp, BarChart2, User as UserIcon, Timer, Database, Globe, Monitor, Smartphone, Tv, ChevronLeft, ChevronRight, Key, UserCheck, UserX, Shield, Hash, X, Zap, Shuffle, Link, ListVideo, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import type { ActivityFilters } from '@/hooks/useUserActivity';
import { useBulkAction } from '@/hooks/useBulkAction';
import type { BulkActionResult } from '@/hooks/useBulkAction';
import { useResellers } from '@/hooks/useResellers';
import { useCategories } from '@/hooks/useCategories';
import { useUserActivity } from '@/hooks/useUserActivity';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { TagInput } from '@/components/ui/TagInput';
import { useAuthStore } from '@/store/auth.store';
import {
  useUsers, useCreateUser, useExtendUser, useBanUser, useUnbanUser,
  useKickUser, useDeleteUser, useUpdateUser, useQuickCreateUser, useCreateTrialUser, useImpersonateUser,
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
import { daysLeft, formatDate, cn, copyToClipboard } from '@/lib/utils';

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
  const { t } = useTranslation();
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
        toast.success(t('users.toastUsersUpdated', { n: result.affected }));
      }
      setBulkActionType(null);
      setBulkValueInput('');
      setSelectedIds(new Set());
      void qc.invalidateQueries({ queryKey: ['users'] });
    } catch { /* handled by mutation onError */ }
  };

  const copyCredentials = (text: string, id: string) => {
    void copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportCsv = () => {
    const rows = data?.items ?? [];
    if (!rows.length) { toast.error(t('users.noExportData')); return; }
    const header = [t('users.username'), t('users.status'), t('users.package'), t('users.expiresAt'), t('users.maxConnections'), t('users.createdAt')];
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
      header: t('users.colUser'),
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
            title={t('users.copy')}
          >
            {copiedId === r.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('users.status'),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'expiresAt',
      header: t('users.colExpiry'),
      render: (r) => {
        const days = daysLeft(r.expiresAt);
        return (
          <div>
            <div className="text-sm text-slate-300">{formatDate(r.expiresAt)}</div>
            <div className={cn('text-xs', days < 7 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-muted')}>
              {days < 0 ? t('users.expired') : t('users.daysLeft', { days })}
            </div>
          </div>
        );
      },
    },
    {
      key: 'maxConnections',
      header: t('users.connections'),
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
      header: t('users.role'),
      render: (r) => (
        <span className="badge bg-primary/10 text-primary-light">{r.role}</span>
      ),
    },
    {
      key: 'owner',
      header: t('users.owner'),
      render: (r) => {
        const owner = r.resellerId ? resellers.find((x: { id: string; username: string }) => x.id === r.resellerId) : null;
        return (
          <span className="text-xs text-muted">
            {r.resellerId ? (owner?.username ?? '—') : t('users.ownerAdmin')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-44',
      render: (r) => (
        <div className="flex items-center gap-1">
          <ActionBtn icon={Clock} title={t('users.actionExtend')} color="text-info"
            onClick={() => { setExtendId(r.id); setExtendDays(30); }} />
          <ActionBtn icon={Pencil} title={t('common.edit')} color="text-muted" onClick={() => setDetailUserId(r.id)} />
          <ActionBtn icon={Wifi} title={t('users.actionKick')} color="text-warning"
            onClick={() => setKickId(r.id)} />
          {r.status === 'BANNED' ? (
            <ActionBtn icon={Check} title={t('users.unban')} color="text-success"
              onClick={() => unbanUser.mutate(r.id)} />
          ) : (
            <ActionBtn icon={Ban} title={t('users.ban')} color="text-warning"
              onClick={() => setBanId(r.id)} />
          )}
          <ActionBtn icon={QrCode} title={t('users.qrCode')} color="text-info"
            onClick={async () => {
              setQrUserId(r.id);
              setQrLoading(true);
              try {
                const res = await api.get<{ success: boolean; data: { qrCodeImage: string; serverUrl: string; username: string } }>(`/users/${r.id}/qr`);
                setQrData(res.data.data);
              } catch {
                toast.error(t('users.qrFailed'));
                setQrUserId(null);
              } finally {
                setQrLoading(false);
              }
            }} />
          <ActionBtn icon={Activity} title={t('users.activity')} color="text-primary"
            onClick={() => setActivityUserId(r.id)} />
          <ActionBtn icon={Trash2} title={t('common.delete')} color="text-danger"
            onClick={() => setDeleteId(r.id)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        description={t('users.userCount', { count: data?.total ?? 0 })}
        actions={
          <>
            <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5 text-sm" title={t('users.downloadCsv')}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('users.downloadReport')}</span>
            </button>
            <button onClick={() => setShowTrialCreate(true)} className="btn-secondary flex items-center gap-1.5 text-sm text-amber-300 border-amber-300/30 hover:border-amber-300/60">
              <Timer className="w-4 h-4" />
              <span className="hidden sm:inline">{t('users.addTrial')}</span>
            </button>
            <button onClick={() => setShowQuickCreate(true)} className="btn-secondary flex items-center gap-1.5 text-sm text-amber-400 border-amber-400/30 hover:border-amber-400/60">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">{t('users.quickAdd')}</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('users.addUser')}</span>
            </button>
          </>
        }
      />

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 mb-3 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm font-semibold text-primary">{t('users.usersSelected', { n: selectedIds.size })}</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-muted hover:text-fg transition-colors" title={t('users.clearSelection')}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => { setBulkValueInput('30'); setBulkActionType('extend'); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Clock className="w-3 h-3" /> {t('users.extend')}
            </button>
            <button onClick={() => setBulkActionType('suspend')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-warning/10 hover:bg-warning/20 text-warning transition-colors">
              <Shield className="w-3 h-3" /> {t('users.suspend')}
            </button>
            <button onClick={() => setBulkActionType('activate')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-success/10 hover:bg-success/20 text-success transition-colors">
              <UserCheck className="w-3 h-3" /> {t('users.activate')}
            </button>
            <button onClick={() => setBulkActionType('delete')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors">
              <UserX className="w-3 h-3" /> {t('common.delete')}
            </button>
            <button onClick={() => setBulkActionType('reset-password')}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Key className="w-3 h-3" /> {t('users.resetPassword')}
            </button>
            <button onClick={() => { setBulkValueInput('1'); setBulkActionType('max-connections'); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <Hash className="w-3 h-3" /> {t('users.maxConnShort')}
            </button>
            <button onClick={() => setShowBulkRenew(true)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-slate-300 transition-colors">
              <RefreshCw className="w-3 h-3" /> {t('users.renewPackage')}
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
              placeholder={t('users.searchPlaceholder')}
              value={search}
              onChange={(e) => updateFilter(setSearch, 'search')(e.target.value)}
            />
          </div>
          <select
            className="input h-9 w-auto min-w-36"
            value={status}
            onChange={(e) => updateFilter(setStatus, 'status')(e.target.value)}
          >
            <option value="">{t('users.allStatuses')}</option>
            <option value="ACTIVE">{t('common.active')}</option>
            <option value="EXPIRED">{t('users.statusExpired')}</option>
            <option value="BANNED">{t('users.statusBanned')}</option>
            <option value="DISABLED">{t('users.statusDisabled')}</option>
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('btn-ghost h-9 flex items-center gap-1.5 text-sm', showFilters && 'text-primary')}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t('users.advancedFilter')}
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
              <option value="">{t('users.allResellers')}</option>
              {resellers.map((r: { id: string; username: string }) => (
                <option key={r.id} value={r.id}>{r.username}</option>
              ))}
            </select>
            <select
              className="input h-9 w-auto min-w-40"
              value={packageId}
              onChange={(e) => updateFilter(setPackageId, 'packageId')(e.target.value)}
            >
              <option value="">{t('users.allPackages')}</option>
              {packages.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input h-9 w-auto min-w-44"
              value={expiresInDays}
              onChange={(e) => updateFilter(setExpiresInDays, 'expiresInDays')(e.target.value)}
            >
              <option value="">{t('users.expiryAll')}</option>
              <option value="7">{t('users.expiring7')}</option>
              <option value="14">{t('users.expiring14')}</option>
              <option value="30">{t('users.expiring30')}</option>
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
              <option value="">{t('users.allAccounts')}</option>
              <option value="true">{t('users.trialAccounts')}</option>
              <option value="false">{t('users.normalAccounts')}</option>
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
                {t('users.clear')}
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
          emptyTitle={t('users.noUsers')}
          emptyDescription={t('users.noUsersDesc')}
        />
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('users.newUser')} size="md">
        <div className="space-y-4">
          {/* Package selector */}
          {packages.length > 0 && (
            <div>
              <label className="label">{t('users.package')}</label>
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
                <option value="">{t('users.selectPackageOptional')}</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('users.packageOption', { name: p.name, days: p.durationDays, conns: p.maxConnections, cost: p.creditCost })}
                  </option>
                ))}
              </select>
              {createForm.packageId && (() => {
                const pkg = packages.find((p) => p.id === createForm.packageId);
                return pkg ? (
                  <p className="text-xs text-warning mt-1">{t('users.willSpendCredits', { cost: pkg.creditCost })}</p>
                ) : null;
              })()}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('users.username')}</label>
              <input className="input" placeholder="user123"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('users.password')}</label>
              <input className="input" type="password" placeholder="••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('users.maxConnLabel')}</label>
              <input className="input" type="number" min={1} max={100}
                value={createForm.maxConnections}
                onChange={(e) => setCreateForm((f) => ({ ...f, maxConnections: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="label">{t('users.colExpiry')}</label>
              <input className="input" type="date"
                value={createForm.expiresAt}
                onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{t('users.notesOptional')}</label>
            <textarea className="input min-h-[60px] resize-none" placeholder={t('users.addNote')}
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {bouquets.length > 0 && (
            <div>
              <label className="label">{t('users.bouquetsOptional')}</label>
              <MultiSelect
                options={bouquets.map((b) => ({ value: b.id, label: b.name }))}
                value={createForm.bouquetIds}
                onChange={(v) => setCreateForm((f) => ({ ...f, bouquetIds: v }))}
                placeholder={t('users.selectBouquet')}
              />
              {createForm.bouquetIds.length === 0 && (() => {
                const pkg = packages.find((p) => p.id === createForm.packageId);
                const pkgBouquets = pkg?.bouquets ?? [];
                if (pkg && pkgBouquets.length > 0) {
                  return (
                    <p className="text-xs text-info mt-1.5">
                      {t('users.packageBouquets', { list: pkgBouquets.map((b) => b.name).join(', ') })}
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-muted mt-1.5">
                    {t('users.defaultBouquetHint')}
                  </p>
                );
              })()}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('common.cancel')}</button>
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
                  toast.error(t('users.credsRequired'));
                }
              }}
              className="btn-primary"
            >
              {createUser.isPending ? t('users.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Extend modal */}
      <Modal open={!!extendId} onClose={() => setExtendId(null)} title={t('users.extendTime')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('users.howManyDays')}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setExtendId(null)} className="btn-ghost">{t('common.cancel')}</button>
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
              {extendUser.isPending ? t('users.extending') : t('users.extend')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Renew Modal */}
      <Modal open={showBulkRenew} onClose={() => setShowBulkRenew(false)} title={t('users.renewNUsers', { n: selectedIds.size })} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('users.selectPackage')}</label>
            <select className="input" value={bulkPackageId} onChange={(e) => setBulkPackageId(e.target.value)}>
              <option value="">{t('users.selectPackageDash')}</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{t('users.packageOptionShort', { name: p.name, days: p.durationDays, cost: p.creditCost })}</option>
              ))}
            </select>
          </div>
          {bulkPackageId && (
            <p className="text-xs text-muted">
              {t('users.renewInfo', { n: selectedIds.size, days: packages.find((p) => p.id === bulkPackageId)?.durationDays ?? 0 })}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setShowBulkRenew(false)}>{t('common.cancel')}</button>
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
              {bulkRenew.isPending ? t('users.renewing') : t('users.renew')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Ban confirm */}
      <ConfirmDialog
        open={!!banId}
        onClose={() => setBanId(null)}
        onConfirm={() => { if (banId) banUser.mutate(banId, { onSuccess: () => setBanId(null) }); }}
        title={t('users.banUserTitle')}
        message={t('users.banUserMsg')}
        confirmLabel={t('users.ban')}
        loading={banUser.isPending}
      />

      <ConfirmDialog
        open={!!kickId}
        onClose={() => setKickId(null)}
        onConfirm={() => { if (kickId) kickUser.mutate(kickId, { onSuccess: () => setKickId(null) }); }}
        title={t('users.kickConnections')}
        message={t('users.kickMsg')}
        confirmLabel={t('users.kickConnections')}
        loading={kickUser.isPending}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title={t('users.deleteUserTitle')}
        message={t('users.deleteUserMsg')}
        confirmLabel={t('common.delete')}
        loading={deleteUser.isPending}
      />

      {/* QR Code Modal */}
      <Modal open={!!qrUserId} onClose={() => { setQrUserId(null); setQrData(null); }} title={t('users.userQrCode')} size="sm">
        <div className="space-y-4 py-2">
          {qrLoading && <p className="text-muted text-sm text-center">{t('common.loading')}</p>}
          {qrData && (
            <>
              <div className="flex flex-col items-center gap-3">
                <img src={qrData.qrCodeImage} alt={t('users.qrCode')} className="w-52 h-52 rounded-xl border border-border" />
                <p className="text-xs text-muted text-center">{t('users.scanWithSmarters')}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{t('users.usernameLower')}</span>
                  <span className="text-slate-200 font-mono">{qrData.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('users.serverUrl')}</span>
                  <span className="text-slate-200 font-mono text-xs">{qrData.serverUrl}</span>
                </div>
                <p className="text-xs text-yellow-400">{t('users.enterPasswordManually')}</p>
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
                <Download className="w-4 h-4" /> {t('users.downloadPng')}
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
        title={t('users.suspendNUsers', { n: selectedIds.size })}
        message={t('users.suspendMsg')}
        confirmLabel={t('users.suspend')}
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Aktifleştir */}
      <ConfirmDialog
        open={bulkActionType === 'activate'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('activate')}
        title={t('users.activateNUsers', { n: selectedIds.size })}
        message={t('users.activateMsg')}
        confirmLabel={t('users.activate')}
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Sil */}
      <ConfirmDialog
        open={bulkActionType === 'delete'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('delete')}
        title={t('users.deleteNUsers', { n: selectedIds.size })}
        message={t('users.deleteUserMsg')}
        confirmLabel={t('common.delete')}
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Şifre Sıfırla — onay */}
      <ConfirmDialog
        open={bulkActionType === 'reset-password'}
        onClose={() => setBulkActionType(null)}
        onConfirm={() => void executeBulkAction('reset-password')}
        title={t('users.resetPasswordNUsers', { n: selectedIds.size })}
        message={t('users.resetPasswordMsg')}
        confirmLabel={t('users.reset')}
        loading={bulkActionMut.isPending}
      />

      {/* Bulk: Uzat */}
      <Modal open={bulkActionType === 'extend'} onClose={() => setBulkActionType(null)} title={t('users.extendNUsers', { n: selectedIds.size })} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('users.howManyDays')}</label>
            <input type="number" min={1} max={3650} className="input"
              value={bulkValueInput}
              onChange={(e) => setBulkValueInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setBulkActionType(null)}>{t('common.cancel')}</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!bulkValueInput || parseInt(bulkValueInput) < 1 || bulkActionMut.isPending}
              onClick={() => void executeBulkAction('extend', parseInt(bulkValueInput))}
            >
              <Clock className="w-4 h-4" />
              {bulkActionMut.isPending ? t('users.extending') : t('users.extend')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk: Max Bağlantı */}
      <Modal open={bulkActionType === 'max-connections'} onClose={() => setBulkActionType(null)} title={t('users.maxConnNUsers', { n: selectedIds.size })} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('users.newMaxConn')}</label>
            <input type="number" min={1} max={100} className="input"
              value={bulkValueInput}
              onChange={(e) => setBulkValueInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-ghost" onClick={() => setBulkActionType(null)}>{t('common.cancel')}</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={!bulkValueInput || parseInt(bulkValueInput) < 1 || bulkActionMut.isPending}
              onClick={() => void executeBulkAction('max-connections', parseInt(bulkValueInput))}
            >
              <Hash className="w-4 h-4" />
              {bulkActionMut.isPending ? t('users.applying') : t('users.apply')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk: Şifre Sıfırlama Sonuçları */}
      <Modal open={!!bulkPasswordResults} onClose={() => setBulkPasswordResults(undefined)} title={t('users.newPasswords')} size="md">
        {bulkPasswordResults && (
          <div className="space-y-3">
            <p className="text-xs text-warning">{t('users.passwordsWarning')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted font-medium text-xs">{t('users.colUser')}</th>
                    <th className="text-left py-2 text-muted font-medium text-xs">{t('users.newPassword')}</th>
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
                          title={t('users.copy')}
                          onClick={() => {
                            void copyToClipboard(r.newPassword);
                            toast.success(t('users.passwordCopied', { username: r.username }));
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
                  void copyToClipboard(text);
                  toast.success(t('users.allCopied'));
                }}
              >
                <Copy className="w-3.5 h-3.5" /> {t('users.copyAll')}
              </button>
              <button className="btn-primary text-sm" onClick={() => setBulkPasswordResults(undefined)}>{t('common.close')}</button>
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
  const { t } = useTranslation();
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
  const [editingAccess, setEditingAccess] = useState(false);
  const [accessDraft, setAccessDraft] = useState<{ allowedIps: string[]; allowedCountries: string[]; blockVpn: boolean; blockDatacenter: boolean; hiddenCategoryIds: string[]; lockDevice: boolean }>({ allowedIps: [], allowedCountries: [], blockVpn: false, blockDatacenter: false, hiddenCategoryIds: [], lockDevice: false });
  const { data: categories = [] } = useCategories();
  const kickUser = useKickUser();
  const impersonate = useImpersonateUser();
  const setClientSession = useAuthStore((st) => st.setClientSession);
  const settings = useSettings();
  const xtreamBaseUrl = (() => {
    const rawUrl = settings?.general?.serverUrl?.trim();
    const port = settings?.xtream?.port ?? 25461;
    if (rawUrl) {
      const host = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
      return `http://${host}:${port}`;
    }
    return `http://${window.location.hostname}:${port}`;
  })();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!user) return null;

  const days = daysLeft(user.expiresAt);

  return (
    <Modal open onClose={onClose} title={t('users.userTitle', { username: user.username })} size="lg">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: 'general',   label: t('users.tabGeneral'),   icon: UserIcon },
          { key: 'playlists', label: t('users.tabPlaylists'), icon: ListVideo },
          { key: 'activity',  label: t('users.activity'),     icon: Activity },
          { key: 'stats',     label: t('users.tabStats'),     icon: BarChart2 },
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
              <div className="text-xs text-muted mb-1">{t('users.username')}</div>
              <div className="font-mono text-sm text-slate-200">{user.username}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t('users.status')}</div>
              <StatusBadge status={user.status} />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t('users.role')}</div>
              <span className="badge bg-primary/10 text-primary-light">{user.role}</span>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t('users.connActiveMax')}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 font-semibold">
                  {user._count?.connections ?? 0} / {user.maxConnections}
                </span>
                {(user._count?.connections ?? 0) > 0 && (
                  <button
                    onClick={() => kickUser.mutate(user.id)}
                    disabled={kickUser.isPending}
                    className="text-[11px] px-2 py-0.5 rounded bg-warning/10 text-warning hover:bg-warning/20 disabled:opacity-50"
                    title={t('users.kickActiveConnections')}
                  >
                    {t('users.kickConnections')}
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t('users.startDate')}</div>
              <div className="text-sm text-slate-300">{formatDate(user.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">{t('users.endDate')}</div>
              <div className="text-sm text-slate-300">{formatDate(user.expiresAt)}</div>
              <div className={cn('text-xs mt-0.5', days < 7 ? 'text-danger' : days < 30 ? 'text-warning' : 'text-muted')}>
                {days < 0 ? t('users.expired') : t('users.daysLeft', { days })}
              </div>
            </div>
          </div>

          {user.notes && (
            <div>
              <div className="text-xs text-muted mb-1">{t('users.notes')}</div>
              <div className="text-sm text-slate-300 bg-surface-2 rounded-lg p-2">{user.notes}</div>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="text-xs text-muted mb-2">{t('users.password')}</div>
            {!editPassword ? (
              <button onClick={() => setEditPassword(true)} className="btn-secondary text-sm flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> {t('users.changePassword')}
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  className="input flex-1"
                  placeholder={t('users.newPasswordPlaceholder')}
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
                      toast.error(t('users.passwordMin4'));
                    }
                  }}
                >
                  {t('common.save')}
                </button>
                <button className="btn-ghost text-sm" onClick={() => { setEditPassword(false); setNewPassword(''); }}>
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* Impersonation — abone olarak panele gir */}
          <div className="border-t border-border pt-4">
            <div className="text-xs text-muted mb-2">{t('users.impersonate')}</div>
            <button
              className="btn-secondary text-sm flex items-center gap-2"
              disabled={impersonate.isPending || user.role !== 'USER'}
              onClick={() => {
                impersonate.mutate(user.id, {
                  onSuccess: (data) => {
                    setClientSession(data.accessToken, data.refreshToken, data.user);
                    window.open('/client/dashboard', '_blank');
                  },
                  onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('users.impersonateError')),
                });
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {impersonate.isPending ? t('common.loading') : t('users.impersonateBtn')}
            </button>
            <p className="text-[11px] text-muted mt-1.5">{t('users.impersonateHint')}</p>
          </div>

          {/* Erişim Kontrolü — hat başına anti-abuse */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted">{t('users.accessControl')}</div>
              {!editingAccess && (
                <button
                  onClick={() => {
                    setAccessDraft({
                      allowedIps: user.allowedIps ?? [],
                      allowedCountries: user.allowedCountries ?? [],
                      blockVpn: user.blockVpn ?? false,
                      blockDatacenter: user.blockDatacenter ?? false,
                      hiddenCategoryIds: user.hiddenCategoryIds ?? [],
                      lockDevice: user.lockDevice ?? false,
                    });
                    setEditingAccess(true);
                  }}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
                </button>
              )}
            </div>

            {!editingAccess ? (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(user.allowedIps?.length ?? 0) > 0 && (
                  <span className="badge bg-surface-2 text-slate-300">IP: {user.allowedIps!.join(', ')}</span>
                )}
                {(user.allowedCountries?.length ?? 0) > 0 && (
                  <span className="badge bg-surface-2 text-slate-300">{t('users.countries')}: {user.allowedCountries!.join(', ')}</span>
                )}
                {user.blockVpn && <span className="badge bg-warning/10 text-warning">{t('users.vpnBlocked')}</span>}
                {user.blockDatacenter && <span className="badge bg-warning/10 text-warning">{t('users.datacenterBlocked')}</span>}
                {(user.hiddenCategoryIds?.length ?? 0) > 0 && <span className="badge bg-surface-2 text-slate-300">{t('users.hiddenCategories')}: {user.hiddenCategoryIds!.length}</span>}
                {user.lockDevice && <span className="badge bg-primary/10 text-primary-light">{t('users.deviceLocked')}</span>}
                {!(user.allowedIps?.length || user.allowedCountries?.length || user.blockVpn || user.blockDatacenter || user.hiddenCategoryIds?.length || user.lockDevice) && (
                  <span className="text-muted">{t('users.noRestrictions')}</span>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] text-muted mb-1">{t('users.allowedIps')} <span className="opacity-60">({t('users.emptyMeansAll')})</span></div>
                  <TagInput value={accessDraft.allowedIps} onChange={(v) => setAccessDraft((a) => ({ ...a, allowedIps: v }))} placeholder="1.2.3.4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted mb-1">{t('users.allowedCountries')} <span className="opacity-60">(ISO: TR, DE… — {t('users.emptyMeansAll')})</span></div>
                  <TagInput value={accessDraft.allowedCountries} onChange={(v) => setAccessDraft((a) => ({ ...a, allowedCountries: v.map((x) => x.toUpperCase()) }))} placeholder="TR" />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={accessDraft.blockVpn} onChange={(e) => setAccessDraft((a) => ({ ...a, blockVpn: e.target.checked }))} />
                  {t('users.blockVpnLabel')}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={accessDraft.blockDatacenter} onChange={(e) => setAccessDraft((a) => ({ ...a, blockDatacenter: e.target.checked }))} />
                  {t('users.blockDatacenterLabel')} <span className="text-[11px] text-muted">({t('users.blockDatacenterHint')})</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={accessDraft.lockDevice} onChange={(e) => setAccessDraft((a) => ({ ...a, lockDevice: e.target.checked }))} />
                  {t('users.lockDeviceLabel')} <span className="text-[11px] text-muted">({t('users.lockDeviceHint')})</span>
                </label>
                <div>
                  <div className="text-[11px] text-muted mb-1">{t('users.hiddenCategories')} <span className="opacity-60">({t('users.hiddenCategoriesHint')})</span></div>
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted">—</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-lg bg-surface-2 border border-border">
                      {categories.map((c) => {
                        const hidden = accessDraft.hiddenCategoryIds.includes(c.id);
                        return (
                          <button key={c.id} type="button"
                            onClick={() => setAccessDraft((a) => ({ ...a, hiddenCategoryIds: hidden ? a.hiddenCategoryIds.filter((x) => x !== c.id) : [...a.hiddenCategoryIds, c.id] }))}
                            className={cn('text-[11px] px-2 py-1 rounded-full border transition-colors', hidden ? 'bg-danger/15 text-danger border-danger/40 line-through' : 'bg-surface text-muted border-border hover:text-fg')}>
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" onClick={() => { onUpdate(userId, accessDraft); setEditingAccess(false); }}>
                    {t('common.save')}
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => setEditingAccess(false)}>{t('common.cancel')}</button>
                </div>
              </div>
            )}
          </div>

          {/* Bağlantı URL'leri — kimlik-bazlı (Xtream) */}
          <div className="border-t border-border pt-4">
            <div className="text-xs text-muted mb-2">{t('users.connectionUrls')}</div>
            {user.plainPassword ? (
              (() => {
                const u = encodeURIComponent(user.username);
                const pw = encodeURIComponent(user.plainPassword);
                const groups: { group: string; items: { label: string; suffix: string }[] }[] = [
                  { group: t('users.fmtPlaylists'), items: [
                    { label: 'M3U Plus — HLS', suffix: `get.php?username=${u}&password=${pw}&type=m3u_plus&output=m3u8` },
                    { label: 'M3U Plus — MPEG-TS', suffix: `get.php?username=${u}&password=${pw}&type=m3u_plus&output=ts` },
                    { label: 'M3U — HLS', suffix: `get.php?username=${u}&password=${pw}&type=m3u&output=m3u8` },
                    { label: 'M3U — MPEG-TS', suffix: `get.php?username=${u}&password=${pw}&type=m3u&output=ts` },
                  ]},
                  { group: t('users.fmtEnigma'), items: [
                    { label: 'Enigma2 (OE 2.0)', suffix: `get.php?username=${u}&password=${pw}&type=enigma2` },
                    { label: 'Enigma2 (.php)', suffix: `enigma2.php?username=${u}&password=${pw}` },
                  ]},
                  { group: t('users.fmtApi'), items: [
                    { label: 'Player API', suffix: `player_api.php?username=${u}&password=${pw}` },
                    { label: 'XMLTV EPG', suffix: `xmltv.php?username=${u}&password=${pw}` },
                  ]},
                ];
                return (
                  <div className="space-y-3">
                    {groups.map(({ group, items }) => (
                      <div key={group} className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-muted/70 font-semibold">{group}</div>
                        {items.map(({ label, suffix }) => {
                          const url = `${xtreamBaseUrl}/${suffix}`;
                          return (
                            <div key={label} className="flex items-center gap-2 bg-surface-2 rounded-lg px-2.5 py-1.5">
                              <span className="text-[10px] font-semibold text-primary-light w-32 shrink-0">{label}</span>
                              <span className="font-mono text-[11px] text-slate-300 truncate flex-1" title={url}>{url}</span>
                              <a href={url} target="_blank" rel="noreferrer" className="btn-ghost p-1 shrink-0" title={t('users.open')}><ExternalLink className="w-3.5 h-3.5" /></a>
                              <button onClick={() => { void copyToClipboard(url); setCopiedUrl(label); setTimeout(() => setCopiedUrl(null), 1500); }} className="btn-ghost p-1 shrink-0" title={t('users.copy')}>
                                {copiedUrl === label ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-muted">{t('users.noPasswordForUrls')}</p>
            )}
          </div>

          {/* Bouquet'ler — görünürlük + düzenleme */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted">{t('users.bouquets')}</div>
              {!editingBouquets && (
                <button
                  onClick={() => { setBouquetDraft(userBouquets.map((b) => b.id)); setEditingBouquets(true); }}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
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
                  {t('users.noBouquets')}
                </div>
              )
            ) : (
              <div className="space-y-2">
                <MultiSelect
                  options={allBouquets.map((b) => ({ value: b.id, label: b.name }))}
                  value={bouquetDraft}
                  onChange={setBouquetDraft}
                  placeholder={t('users.selectBouquet')}
                />
                {bouquetDraft.length === 0 && (
                  <p className="text-xs text-warning">{t('users.bouquetWarning')}</p>
                )}
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => { onUpdate(userId, { bouquetIds: bouquetDraft }); setEditingBouquets(false); }}
                  >
                    {t('common.save')}
                  </button>
                  <button className="btn-ghost text-sm" onClick={() => setEditingBouquets(false)}>{t('common.cancel')}</button>
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
          {statsLoading && <div className="grid grid-cols-4 gap-3"><div className="card p-4 col-span-4 text-center text-muted text-sm">{t('common.loading')}</div></div>}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Timer className="w-4 h-4 text-primary mb-0.5" />
                <div className="text-lg font-bold text-slate-100">{formatWatchTime(stats.totalDurationSeconds)}</div>
                <div className="text-[11px] text-muted">{t('users.totalWatch')}</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Database className="w-4 h-4 text-success mb-0.5" />
                <div className="text-lg font-bold text-slate-100">{formatBytes(Number(stats.totalBytesTransferred))}</div>
                <div className="text-[11px] text-muted">{t('users.totalData')}</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                <Clock className="w-4 h-4 text-warning mb-0.5" />
                <div className="text-sm font-semibold text-slate-100 leading-tight">
                  {stats.lastActivity ? new Date(stats.lastActivity.createdAt).toLocaleDateString('tr-TR') : '-'}
                </div>
                <div className="text-[11px] text-muted">{t('users.lastActivity')}</div>
              </div>
              <div className="card p-3 flex flex-col items-center gap-1 text-center">
                {(() => {
                  const topDevice = Object.entries(stats.deviceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
                  const Icon = DEVICE_ICON[topDevice] ?? Monitor;
                  return (
                    <>
                      <Icon className="w-4 h-4 text-slate-400 mb-0.5" />
                      <div className="text-sm font-semibold text-slate-100 capitalize">{topDevice}</div>
                      <div className="text-[11px] text-muted">{t('users.mainDevice')}</div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <div className="text-[11px] text-muted mb-1">{t('users.startDate')}</div>
              <input
                type="date"
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.startDate}
                onChange={(e) => setFilterDraft((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-[11px] text-muted mb-1">{t('users.endDate')}</div>
              <input
                type="date"
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.endDate}
                onChange={(e) => setFilterDraft((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-[11px] text-muted mb-1">{t('users.action')}</div>
              <select
                className="input text-xs py-1.5 px-2 h-8"
                value={filterDraft.action}
                onChange={(e) => setFilterDraft((f) => ({ ...f, action: e.target.value }))}
              >
                <option value="">{t('users.all')}</option>
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
              {t('common.filter')}
            </button>
            {(activityFilters.startDate || activityFilters.endDate || activityFilters.action) && (
              <button
                className="btn-ghost text-xs px-3 h-8"
                onClick={() => { setFilterDraft({ startDate: '', endDate: '', action: '' }); setActivityFilters({}); setActivityPage(1); }}
              >
                {t('users.clear')}
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="text-left py-2 px-2 font-medium">{t('users.dateTime')}</th>
                  <th className="text-left py-2 px-2 font-medium">{t('users.action')}</th>
                  <th className="text-left py-2 px-2 font-medium">IP</th>
                  <th className="text-left py-2 px-2 font-medium">{t('users.country')}</th>
                  <th className="text-left py-2 px-2 font-medium">{t('users.device')}</th>
                  <th className="text-left py-2 px-2 font-medium">{t('users.duration')}</th>
                </tr>
              </thead>
              <tbody>
                {activityLoading && (
                  <tr><td colSpan={6} className="text-center text-muted py-8">{t('common.loading')}</td></tr>
                )}
                {!activityLoading && (!activityData?.items || activityData.items.length === 0) && (
                  <tr><td colSpan={6} className="text-center text-muted py-8">{t('users.noRecords')}</td></tr>
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
                {t('users.recordsPagination', { total: activityData.total, page: activityData.page, pages: activityData.totalPages })}
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
          {statsLoading && <p className="text-muted text-sm text-center py-6">{t('common.loading')}</p>}
          {stats && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4 text-center">
                  <div className="text-xl font-bold text-primary">{formatWatchTime(stats.totalDurationSeconds)}</div>
                  <div className="text-xs text-muted mt-1">{t('users.totalWatch')}</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-xl font-bold text-success">{formatBytes(Number(stats.totalBytesTransferred))}</div>
                  <div className="text-xs text-muted mt-1">{t('users.totalData')}</div>
                </div>
              </div>

              {Object.keys(stats.actionBreakdown).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-slate-300 mb-2">{t('users.actionBreakdown')}</div>
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
                  <div className="text-sm font-medium text-slate-300 mb-2">{t('users.deviceBreakdown')}</div>
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
                  <div className="text-xs text-muted mb-1">{t('users.lastActivity')}</div>
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
  CONNECTION_LIMIT: 'bg-danger/20 text-danger',
};

function activityLabel(action: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  return t(`users.activityAction.${action}`, { defaultValue: action });
}

function ActivityModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useUserActivity(userId);

  return (
    <Modal open onClose={onClose} title={t('users.userActivity')} size="lg">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading && <p className="text-muted text-sm text-center py-6">{t('common.loading')}</p>}
        {!isLoading && (!data?.items || data.items.length === 0) && (
          <p className="text-muted text-sm text-center py-6">{t('users.noActivity')}</p>
        )}
        {data?.items.map((log) => (
          <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-border/30">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', ACTION_BADGE[log.action] ?? 'bg-surface-2 text-muted')}>
              {activityLabel(log.action, t)}
            </span>
            <div className="flex-1 min-w-0">
              {log.ip && <span className="font-mono text-xs text-muted mr-2">{log.ip}</span>}
              {log.country && <span className="text-xs text-muted mr-2">{log.country}</span>}
              {log.deviceType && log.deviceType !== 'unknown' && <span className="text-xs text-muted mr-2">{log.deviceType}</span>}
              {log.streamId && <span className="text-xs text-muted">Stream: {log.streamId.slice(0, 8)}…</span>}
            </div>
            <span className="text-xs text-muted flex-shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
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
  const { t } = useTranslation();
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
    void copyToClipboard(url);
    setCopiedKey(`token:${token}`);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success(t('users.playlistUrlCopied'));
  };

  const copyStdUrl = (token: string) => {
    const url = `${xtreamBaseUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(token)}&type=m3u_plus`;
    void copyToClipboard(url);
    setCopiedKey(`std:${token}`);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success(t('users.standardUrlCopied'));
  };

  const toggleActive = async (pl: UserPlaylist) => {
    await api.put(`/users/playlists/${pl.id}`, { isActive: !pl.isActive });
    void qc.invalidateQueries({ queryKey: ['user-playlists', userId] });
  };

  const deletePl = async (id: string) => {
    await api.delete(`/users/playlists/${id}`);
    void qc.invalidateQueries({ queryKey: ['user-playlists', userId] });
    toast.success(t('users.playlistDeleted'));
  };

  const editing = editingId ? playlists.find((p) => p.id === editingId) ?? null : null;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{t('users.playlistCount', { n: playlists.length })}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {t('users.newPlaylist')}
        </button>
      </div>

      {isLoading && <p className="text-center text-muted text-sm py-6">{t('common.loading')}</p>}
      {!isLoading && playlists.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-muted">
          <ListVideo className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t('users.noPlaylists')}</p>
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
                  <button onClick={() => copyUrl(pl.token)} className="text-muted hover:text-fg shrink-0 transition-colors" title={t('users.copy')}>
                    {copiedKey === `token:${pl.token}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={url} target="_blank" rel="noreferrer" className="text-muted hover:text-fg shrink-0 transition-colors" title={t('users.open')}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Standard Xtream URL */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('users.standard')}</span>
                <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-muted font-mono truncate flex-1">
                    {`${xtreamBaseUrl}/get.php?username=${encodeURIComponent(username)}&password=***&type=m3u_plus`}
                  </span>
                  <button onClick={() => copyStdUrl(pl.token)} className="text-muted hover:text-fg shrink-0 transition-colors" title={t('users.copyStandardUrl')}>
                    {copiedKey === `std:${pl.token}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Filters summary */}
              {pl.filters && (pl.filters.onlyLive || pl.filters.onlyVod) && (
                <p className="text-[11px] text-muted">
                  {t('users.filterSummary', { value: pl.filters.onlyLive ? t('users.onlyLive') : t('users.onlyVod') })}
                </p>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-[11px] text-muted">
                <span>{t('users.accessCount', { n: pl.accessCount })}</span>
                {pl.lastAccessed && <span>{t('users.lastAccess', { date: new Date(pl.lastAccessed).toLocaleDateString('tr-TR') })}</span>}
                {pl.expiresAt && <span className="text-warning">{t('users.expiryDate', { date: new Date(pl.expiresAt).toLocaleDateString('tr-TR') })}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                <button
                  onClick={() => void toggleActive(pl)}
                  className={cn('flex items-center gap-1 text-[11px] transition-colors', pl.isActive ? 'text-success' : 'text-muted')}
                  title={pl.isActive ? t('users.makeInactive') : t('users.makeActive')}
                >
                  {pl.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {pl.isActive ? t('common.active') : t('common.inactive')}
                </button>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEditingId(pl.id)} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-fg transition-colors" title={t('common.edit')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => void deletePl(pl.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-muted hover:text-danger transition-colors" title={t('common.delete')}>
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
  const { t } = useTranslation();
  const [name, setName]       = useState(existing?.name ?? '');
  const [type, setType]       = useState(existing?.type ?? 'm3u_plus');
  const [filter, setFilter]   = useState<'all' | 'live' | 'vod'>(
    existing?.filters?.onlyLive ? 'live' : existing?.filters?.onlyVod ? 'vod' : 'all',
  );
  const [expiry, setExpiry]   = useState<'unlimited' | 'date'>('unlimited');
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt?.slice(0, 10) ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error(t('users.nameRequired')); return; }
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
        toast.success(t('users.playlistUpdated'));
      } else {
        await api.post(`/users/${userId}/playlists`, body);
        toast.success(t('users.playlistCreated'));
      }
      onSaved();
    } catch {
      toast.error(t('users.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? t('users.editPlaylist') : t('users.newPlaylist')} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">{t('users.name')}</label>
          <input className="input" placeholder={t('users.playlistNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="label">{t('users.type')}</label>
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
          <label className="label">{t('users.contentFilter')}</label>
          <div className="flex gap-1.5">
            {[['all', t('users.all')], ['live', t('users.onlyLive')], ['vod', t('users.onlyVod')]] .map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => setFilter(v as 'all' | 'live' | 'vod')}
                className={cn('px-3 py-1.5 text-xs rounded-lg transition-colors', filter === v ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{t('users.validity')}</label>
          <div className="flex gap-1.5 mb-2">
            {[['unlimited', t('users.unlimited')], ['date', t('users.selectDate')]] .map(([v, lbl]) => (
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
          <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          <button type="button" onClick={() => void handleSave()} disabled={loading} className="btn-primary">
            {loading ? t('users.saving') : t('common.save')}
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
  { labelKey: 'users.preset1h',  hours: 1 },
  { labelKey: 'users.preset3h',  hours: 3 },
  { labelKey: 'users.preset6h',  hours: 6 },
  { labelKey: 'users.preset12h', hours: 12 },
  { labelKey: 'users.preset24h', hours: 24 },
] as const;

const STANDARD_PRESETS = [
  { labelKey: 'users.preset1mo', days: 30 },
  { labelKey: 'users.preset3mo', days: 90 },
  { labelKey: 'users.preset6mo', days: 180 },
  { labelKey: 'users.preset9mo', days: 270 },
  { labelKey: 'users.preset1y',  days: 365 },
  { labelKey: 'users.preset2y',  days: 730 },
] as const;

const CONN_PRESETS = [1, 2, 3, 5] as const;

interface QuickCreateModalProps {
  onClose: () => void;
  mutation: ReturnType<typeof useQuickCreateUser>;
}

// preset key: `h:N` for hours, `d:N` for days, `custom` for custom days
type DurationKey = `h:${number}` | `d:${number}` | 'custom';

function QuickCreateModal({ onClose, mutation }: QuickCreateModalProps) {
  const { t } = useTranslation();
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
      `${t('users.username')}: ${result.user.username}`,
      `${t('users.password')}: ${result.user.password}`,
      `${t('users.expiry')}: ${new Date(result.user.expiresAt).toLocaleDateString('tr-TR')}`,
      `M3U URL: ${result.m3uUrl}`,
    ].join('\n');
    void copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('users.infoCopied'));
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
    <Modal open onClose={onClose} title={t('users.quickCreateTitle')} size="sm">
      {!result ? (
        <div className="space-y-4">
          {/* Kullanıcı adı */}
          <div>
            <label className="label">{t('users.username')} <span className="text-muted font-normal">{t('users.autoIfEmpty')}</span></label>
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
                title={t('users.generateRandom')}
                onClick={() => setUsername(randomStr(8))}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Şifre */}
          <div>
            <label className="label">{t('users.password')} <span className="text-muted font-normal">{t('users.autoIfEmpty')}</span></label>
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
                title={t('users.generateRandom')}
                onClick={() => setPassword(randomStr(8))}
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Süre */}
          <div className="space-y-2">
            <label className="label">{t('users.duration')}</label>

            {/* Test satırı */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">{t('users.test')}</span>
              <div className="flex flex-wrap gap-1.5">
                {TEST_PRESETS.map(({ labelKey, hours }) => {
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
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standart satırı */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t('users.standard')}</span>
              <div className="flex flex-wrap gap-1.5">
                {STANDARD_PRESETS.map(({ labelKey, days }) => {
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
                      {t(labelKey)}
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
                  {t('users.custom')}
                </button>
              </div>
              {durationKey === 'custom' && (
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="input mt-1 w-32 text-sm"
                  placeholder={t('users.dayCount')}
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <p className="text-xs text-muted">{t('users.expiry')}: {expiresLabel}</p>
          </div>

          {/* Max Bağlantı */}
          <div>
            <label className="label">{t('users.maxConnLabel')}</label>
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
                {t('users.custom')}
              </button>
            </div>
            {connsPreset === 'custom' && (
              <input
                type="number"
                min={1}
                max={100}
                className="input mt-2 w-24 text-sm"
                placeholder={t('users.count')}
                value={customConns}
                onChange={(e) => setCustomConns(e.target.value)}
              />
            )}
          </div>

          {/* Notlar */}
          <div>
            <label className="label">{t('users.notes')} <span className="text-muted font-normal">{t('users.optional')}</span></label>
            <input
              className="input"
              placeholder={t('users.customerNotePlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void handleCreate()}
              className="btn-primary flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {mutation.isPending ? t('users.creating') : t('users.createAndCopy')}
            </button>
          </div>
        </div>
      ) : (
        /* ─── Başarı kartı ─── */
        <div className="space-y-4">
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-success font-semibold text-sm">
              <Check className="w-4 h-4" /> {t('users.userCreated')}
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-muted">{t('users.username')}</span>
              <span className="font-mono text-slate-200 font-medium">{result.user.username}</span>
              <span className="text-muted">{t('users.password')}</span>
              <span className="font-mono text-slate-200 font-medium">{result.user.password}</span>
              <span className="text-muted">{t('users.expiry')}</span>
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
              {copied ? t('users.copied') : t('users.copy')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Zap className="w-4 h-4" /> {t('users.newLine')}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost text-sm">{t('common.close')}</button>
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
  const { t } = useTranslation();
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
    const text = `${t('users.username')}: ${result.user.username}\n${t('users.password')}: ${result.user.password}\nM3U URL: ${result.m3uUrl}`;
    return (
      <Modal open onClose={onClose} title={t('users.trialCreatedTitle')} size="md">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted">{t('users.username')}</span>
              <span className="font-mono text-amber-300">{result.user.username}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">{t('users.password')}</span>
              <span className="font-mono text-amber-300">{result.user.password}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">{t('users.duration')}</span>
              <span className="font-mono">{new Date(result.user.expiresAt).toLocaleDateString('tr-TR')}</span>
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 border border-border p-3">
            <p className="text-xs text-muted mb-1">M3U URL</p>
            <p className="font-mono text-xs text-primary break-all">{result.m3uUrl}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { void copyToClipboard(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-secondary text-sm flex-1"
            >
              {copied ? t('users.copied') : t('users.copy')}
            </button>
            <button onClick={() => { setResult(null); setUsername(''); setPassword(''); }} className="btn-ghost text-sm">{t('users.new')}</button>
            <button onClick={onClose} className="btn-ghost text-sm">{t('common.close')}</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={t('users.trialAddTitle')} size="sm">
      <div className="space-y-4">
        <div>
          <label className="label">{t('users.username')} <span className="text-muted text-xs">{t('users.autoIfEmpty')}</span></label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="trial_..." />
        </div>
        <div>
          <label className="label">{t('users.password')} <span className="text-muted text-xs">{t('users.autoIfEmpty')}</span></label>
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('users.autoGenerated')} />
        </div>
        <div>
          <label className="label">{t('users.duration')}</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setDurationDays(d)}
                className={cn('py-2 rounded-lg text-sm font-medium border transition-colors', durationDays === d ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:text-fg hover:border-border/80')}
              >
                {t('users.daysN', { n: d })}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{t('users.maxConnShort')}</label>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                onClick={() => setMaxConnections(n)}
                className={cn('py-2 rounded-lg text-sm font-medium border transition-colors', maxConnections === n ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:text-fg')}
              >
                {t('users.connectionsN', { n })}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={handleCreate} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? t('users.creating') : t('common.create')}
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
