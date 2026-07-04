import { useState } from 'react';
import {
  Search, X, ChevronLeft, ChevronRight, Download,
  Users, ChevronUp, ChevronDown, ChevronsUpDown, Zap,
} from 'lucide-react';
import {
  useResellerUsers,
  useResellerBulkAction,
  useResellerDashboard,
} from '@/hooks/useResellerPanel';
import type { ResellerUserRow } from '@/hooks/useResellerPanel';
import { ResellerUserDrawer } from './ResellerUserDrawer';
import { ResellerQuickCreateModal } from './ResellerQuickCreateModal';
import { cn, daysLeft, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-400',
    DISABLED: 'bg-slate-500/15 text-slate-400',
    BANNED: 'bg-red-500/15 text-red-400',
    EXPIRED: 'bg-amber-500/15 text-amber-400',
  };
  return (
    <span className={cn('text-[11px] px-1.5 py-0.5 rounded font-medium', map[status] ?? 'bg-surface-2 text-muted')}>
      {status}
    </span>
  );
}

type SortField = 'username' | 'expiresAt' | 'createdAt';
type SortDir = 'asc' | 'desc';
type DurationKey = `h:${number}` | `d:${number}` | 'custom';

// ─── SortHeader ──────────────────────────────────────────────────────────────

function SortHeader({
  field, label, current, dir, onSort,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = current === field;
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted hover:text-slate-300 transition-colors"
    >
      {label}
      <Icon className={cn('w-3.5 h-3.5', active ? 'text-primary' : 'opacity-40')} />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ResellerUsersPage() {
  const resellerUser = useAuthStore((s) => s.resellerUser);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState(30);
  const [detailUser, setDetailUser] = useState<ResellerUserRow | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const { data: dashboard } = useResellerDashboard();
  const { data: users, isLoading } = useResellerUsers(
    page, 50, search || undefined, statusFilter || undefined,
    sortBy, sortDir, expiryFilter || undefined,
  );
  const bulkAction = useResellerBulkAction();

  const credits = dashboard?.credits ?? resellerUser?.credits ?? 0;
  const items = users?.items ?? [];
  const totalPages = users?.totalPages ?? 1;
  const allSelected = items.length > 0 && items.every((u) => selectedIds.includes(u.id));

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const toggleAll = () => setSelectedIds(allSelected ? [] : items.map((u) => u.id));
  const toggleOne = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setSelectedIds([]);
  };

  const handleBulk = async (action: 'extend' | 'suspend' | 'activate') => {
    if (selectedIds.length === 0) return;
    await bulkAction.mutateAsync({ action, userIds: selectedIds, days: action === 'extend' ? bulkDays : undefined });
    setSelectedIds([]);
  };

  const exportCSV = () => {
    const header = ['Kullanıcı Adı', 'Durum', 'Bitiş Tarihi', 'Kalan Gün', 'Max Bağlantı', 'Oluşturulma'];
    const rows = items.map((u) => [
      u.username, u.status,
      new Date(u.expiresAt).toLocaleDateString('tr-TR'),
      String(daysLeft(u.expiresAt)),
      String(u.maxConnections),
      new Date(u.createdAt).toLocaleDateString('tr-TR'),
    ]);
    const csv = '﻿' + [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kullanicilar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Kullanıcılarım</h1>
          <p className="text-sm text-muted">{users?.total ?? 0} kullanıcı</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-ghost flex items-center gap-1.5 text-sm px-3">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => setShowQuickCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4" /> Hızlı Hat Ekle
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Kullanıcı ara…"
              className="input pl-9 w-full"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button type="submit" className="btn-ghost text-sm px-3">Ara</button>
        </form>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSelectedIds([]); }} className="input text-sm w-36">
          <option value="">Tüm Durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="DISABLED">Pasif</option>
          <option value="BANNED">Banlı</option>
        </select>

        <select value={expiryFilter} onChange={(e) => { setExpiryFilter(e.target.value); setPage(1); setSelectedIds([]); }} className="input text-sm w-40">
          <option value="">Tüm Bitiş</option>
          <option value="active">Aktif (süresi dolmamış)</option>
          <option value="expired">Süresi Dolmuş</option>
          <option value="thisWeek">7 Gün İçinde Bitiyor</option>
          <option value="thisMonth">30 Gün İçinde Bitiyor</option>
        </select>
      </div>

      {/* Bulk toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
          <span className="text-sm text-primary font-medium">{selectedIds.length} seçili</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted">Uzat:</span>
              <input type="number" min={1} max={3650} value={bulkDays} onChange={(e) => setBulkDays(+e.target.value)} className="input w-16 text-xs py-1" />
              <span className="text-xs text-muted">gün</span>
              <button onClick={() => void handleBulk('extend')} disabled={bulkAction.isPending}
                className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors">
                Uzat
              </button>
            </div>
            <button onClick={() => void handleBulk('suspend')} disabled={bulkAction.isPending}
              className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors">
              Askıya Al
            </button>
            <button onClick={() => void handleBulk('activate')} disabled={bulkAction.isPending}
              className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 transition-colors">
              Aktifleştir
            </button>
            <button onClick={() => setSelectedIds([])} className="text-muted hover:text-fg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10 text-muted text-sm">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">Kullanıcı bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-primary" />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="username" label="Kullanıcı" current={sortBy} dir={sortDir} onSort={toggleSort} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">Durum</th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="expiresAt" label="Bitiş" current={sortBy} dir={sortDir} onSort={toggleSort} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">Bağlantı</th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="createdAt" label="Oluşturulma" current={sortBy} dir={sortDir} onSort={toggleSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const dl = daysLeft(u.expiresAt);
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border/50 hover:bg-surface-2/50 cursor-pointer"
                      onClick={() => setDetailUser(u)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleOne(u.id)} className="w-3.5 h-3.5 accent-primary" />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">{u.username}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs', dl < 0 ? 'text-danger' : dl < 7 ? 'text-warning' : 'text-muted')}>
                          {formatDate(u.expiresAt)}
                          <span className="ml-1 opacity-70">({dl < 0 ? 'Dolmuş' : `${dl}g`})</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {u._count?.connections ?? 0}/{u.maxConnections}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDate(u.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{users?.total ?? 0} toplam, sayfa {page}/{totalPages}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setSelectedIds([]); }} className="btn-ghost p-1.5">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => { setPage((p) => p + 1); setSelectedIds([]); }} className="btn-ghost p-1.5">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Create Modal */}
      {showQuickCreate && <ResellerQuickCreateModal onClose={() => setShowQuickCreate(false)} credits={credits} />}

      {/* User Drawer */}
      {detailUser && (
        <ResellerUserDrawer
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onUpdated={() => setDetailUser(null)}
        />
      )}
    </div>
  );
}
