import { useState, useCallback } from 'react';
import {
  CreditCard, Users, UserCheck, UserPlus, AlertTriangle, Clock,
  Search, X, Check, Copy, Zap, Shuffle,
  ChevronLeft, ChevronRight, RefreshCw, ExternalLink,
  Activity, CalendarDays, Timer,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAuthStore } from '@/store/auth.store';
import {
  useResellerDashboard,
  useResellerUsers,
  useResellerQuickCreate,
  useResellerBulkAction,
  useCreditPricing,
  computeCustomCreditCost,
} from '@/hooks/useResellerPanel';
import type { ResellerUserRow, QuickCreateResult } from '@/hooks/useResellerPanel';
import { DEFAULT_CREDIT_PRICING } from '@/hooks/useSettings';
import { Modal } from '@/components/ui/Modal';
import { ResellerUserDrawer } from './ResellerUserDrawer';
import { cn, daysLeft, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

type DurationKey = `h:${number}` | `d:${number}` | 'custom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randStr(len = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, variant = 'default',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}) {
  const iconBg = {
    default: 'bg-surface-2 text-muted',
    primary: 'bg-primary/15 text-primary',
    success: 'bg-emerald-500/15 text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-400',
    info: 'bg-blue-500/15 text-blue-400',
  }[variant];

  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

// ─── Quick Create Modal ───────────────────────────────────────────────────────

function QuickCreateModal({ onClose, credits }: { onClose: () => void; credits: number }) {
  const mutation = useResellerQuickCreate();
  const { data: pricingData } = useCreditPricing();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [randomUser, setRandomUser] = useState(true);
  const [randomPass, setRandomPass] = useState(true);
  const [durationKey, setDurationKey] = useState<DurationKey>('d:30');
  const [customDays, setCustomDays] = useState('30');
  const [connections, setConnections] = useState(1);
  const [useCustomConns, setUseCustomConns] = useState(false);
  const [customConns, setCustomConns] = useState(1);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<QuickCreateResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const effectiveConns = useCustomConns ? customConns : connections;

  // Always defined — falls back to DEFAULT_CREDIT_PRICING if query errored
  const pricing = pricingData ?? DEFAULT_CREDIT_PRICING;

  // Compute credit cost for the selected duration
  const creditCost = (() => {
    if (durationKey === 'custom') {
      return computeCustomCreditCost(parseInt(customDays) || 30, pricing);
    }
    const [type, val] = durationKey.split(':');
    if (type === 'h') {
      const match = pricing.testDurations.find((d) => d.hours === Number(val));
      return Math.max(0, match?.credits ?? 0);
    }
    return computeCustomCreditCost(Number(val), pricing);
  })();

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success('Kopyalandı');
  }, []);

  const handleCreate = async () => {
    const u = randomUser ? randStr(8) : username.trim();
    const p = randomPass ? randStr(8) : password.trim();
    if (!u || !p) { toast.error('Kullanıcı adı ve şifre gerekli'); return; }

    let payload: { durationDays?: number; durationHours?: number } = {};
    if (durationKey === 'custom') {
      payload = { durationDays: parseInt(customDays) || 30 };
    } else {
      const [type, val] = durationKey.split(':');
      if (type === 'h') payload = { durationHours: Number(val) };
      else payload = { durationDays: Number(val) };
    }

    const data = await mutation.mutateAsync({
      username: u, password: p,
      ...payload,
      maxConnections: effectiveConns,
      notes: notes.trim() || undefined,
    });
    setResult(data);
  };

  if (result) {
    return (
      <Modal open onClose={onClose} title="Kullanıcı Oluşturuldu" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-3">
            {[
              { label: 'Kullanıcı Adı', value: result.user.username },
              { label: 'Şifre', value: result.user.password },
              { label: 'Bitiş', value: formatDate(result.user.expiresAt) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-200 text-sm">{value}</span>
                  <button onClick={() => copy(value, label)} className="text-muted hover:text-fg">
                    {copied === label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {[
              { label: 'M3U URL', value: result.m3uUrl },
              { label: 'Player API', value: result.playerApiUrl },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
                <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
                  <span className="font-mono text-xs text-muted truncate flex-1">{value}</span>
                  <button onClick={() => copy(value, label)} className="shrink-0 text-muted hover:text-fg">
                    {copied === label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-fg">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setResult(null); setUsername(''); setPassword(''); setNotes(''); }}
              className="btn-ghost flex-1 text-sm"
            >
              Yeni Kullanıcı
            </button>
            <button onClick={onClose} className="btn-primary flex-1 text-sm">Kapat</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="⚡ Hızlı Hat Ekle" size="sm">
      <div className="space-y-4">
        {creditCost > credits && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Yetersiz kredi. Yöneticinizle iletişime geçin.
          </div>
        )}

        <p className="text-xs text-muted">Bu işlem <span className="text-primary font-medium">{creditCost} kredi</span> düşecek (mevcut: {credits})</p>

        {/* Username */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Kullanıcı Adı</label>
            <button
              onClick={() => setRandomUser((v) => !v)}
              className={cn('flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors',
                randomUser ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted')}
            >
              <Shuffle className="w-3 h-3" /> Rastgele
            </button>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={randomUser ? 'Otomatik oluşturulacak' : 'kullanici_adi'}
            disabled={randomUser}
            className="input w-full disabled:opacity-40"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Şifre</label>
            <button
              onClick={() => setRandomPass((v) => !v)}
              className={cn('flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors',
                randomPass ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted')}
            >
              <Shuffle className="w-3 h-3" /> Rastgele
            </button>
          </div>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={randomPass ? 'Otomatik oluşturulacak' : 'sifre'}
            disabled={randomPass}
            className="input w-full disabled:opacity-40"
          />
        </div>

        {/* Duration — Test row */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Süre — Test</label>
          <div className="flex flex-wrap gap-1.5">
            {pricing.testDurations.map((p) => {
              const key: DurationKey = `h:${p.hours}`;
              const cr = p.credits;
              return (
                <button
                  key={p.hours}
                  onClick={() => setDurationKey(key)}
                  className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                    durationKey === key
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted hover:border-primary/50')}
                >
                  {p.label}{cr > 0 ? ` (${cr}k)` : ''}
                </button>
              );
            })}
          </div>

          {/* Duration — Standard row */}
          <label className="text-xs font-medium text-muted">Süre — Standart</label>
          <div className="flex flex-wrap gap-1.5">
            {pricing.durations.map((p) => {
              const key: DurationKey = `d:${p.days}`;
              return (
                <button
                  key={p.days}
                  onClick={() => setDurationKey(key)}
                  className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                    durationKey === key
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted hover:border-primary/50')}
                >
                  {p.label} ({p.credits}k)
                </button>
              );
            })}
            <button
              onClick={() => setDurationKey('custom')}
              className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                durationKey === 'custom'
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'border-border text-muted hover:border-primary/50')}
            >
              Özel
            </button>
          </div>
          {durationKey === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={3650} value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                className="input w-24 text-sm"
              />
              <span className="text-xs text-muted">gün</span>
              <span className="text-xs text-primary font-medium">= {creditCost} kredi</span>
            </div>
          )}
        </div>

        {/* Connections */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted">Bağlantı Sayısı</label>
            <button
              onClick={() => setUseCustomConns((v) => !v)}
              className={cn('flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors',
                useCustomConns ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted')}
            >
              Özel
            </button>
          </div>
          {useCustomConns ? (
            <input
              type="number" min={1} max={10} value={customConns}
              onChange={(e) => setCustomConns(+e.target.value)}
              className="input w-20"
            />
          ) : (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConnections(n)}
                  className={cn('w-9 h-9 rounded-lg text-sm font-medium border transition-colors',
                    connections === n
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted hover:border-primary/50')}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">Not (opsiyonel)</label>
          <input
            type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Müşteri notu…"
            className="input w-full text-sm"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">İptal</button>
          <button
            onClick={() => void handleCreate()}
            disabled={mutation.isPending || creditCost > credits}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Oluştur ve Kopyala
          </button>
        </div>
      </div>
    </Modal>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export function ResellerDashboardPage() {
  const resellerUser = useAuthStore((s) => s.resellerUser);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDays, setBulkDays] = useState(30);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [detailUser, setDetailUser] = useState<ResellerUserRow | null>(null);

  const { data: dashboard, isLoading: dashLoading } = useResellerDashboard();
  const { data: users, isLoading: usersLoading } = useResellerUsers(page, 20, search || undefined, statusFilter || undefined);
  const bulkAction = useResellerBulkAction();

  const credits = dashboard?.credits ?? resellerUser?.credits ?? 0;
  const totalPages = users?.totalPages ?? 1;
  const items = users?.items ?? [];
  const allSelected = items.length > 0 && items.every((u) => selectedIds.includes(u.id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : items.map((u) => u.id));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Hoş Geldiniz, <span className="text-primary">{resellerUser?.username}</span>
          </h1>
          <p className="text-sm text-muted">Bayi Kontrol Paneli</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{credits} Kredi</span>
          </div>
          <button
            onClick={() => setShowQuickCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Zap className="w-4 h-4" /> Hızlı Hat Ekle
          </button>
        </div>
      </div>

      {/* Warning banners */}
      {!dashLoading && (
        <div className="space-y-2">
          {credits < 10 && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Krediniz azalıyor ({credits} kredi kaldı). Yöneticinizle iletişime geçin.
            </div>
          )}
          {(dashboard?.expiringSoonCount ?? 0) > 0 && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-300">
              <Clock className="w-4 h-4 flex-shrink-0" />
              {dashboard!.expiringSoonCount} kullanıcının aboneliği 7 gün içinde sona eriyor.
            </div>
          )}
        </div>
      )}

      {/* Stat cards — row 1 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Kredi Bakiyesi" value={dashLoading ? '…' : credits} icon={CreditCard} variant="primary" />
        <StatCard
          label="Kullanıcılar"
          value={dashLoading ? '…' : (
            dashboard?.maxUsers
              ? `${dashboard.totalUsers} / ${dashboard.maxUsers}`
              : String(dashboard?.totalUsers ?? 0)
          )}
          icon={Users}
        />
        <StatCard label="Aktif Kullanıcı" value={dashLoading ? '…' : (dashboard?.activeUsers ?? 0)} icon={UserCheck} variant="success" />
        <StatCard label="Bu Hafta Yeni" value={dashLoading ? '…' : (dashboard?.newThisWeek ?? 0)} icon={UserPlus} variant="info" />
      </div>

      {/* Stat cards — row 2 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Bugün Bağlantı" value={dashLoading ? '…' : (dashboard?.connectionsToday ?? 0)} icon={Activity} variant="info" />
        <StatCard label="Bu Ay Yeni Kullanıcı" value={dashLoading ? '…' : (dashboard?.newUsersThisMonth ?? 0)} icon={CalendarDays} />
        <StatCard label="7 Günde Dolacak" value={dashLoading ? '…' : (dashboard?.expiringSoon ?? 0)} icon={Clock} variant="warning" />
        <StatCard label="Ort. İzleme (dk)" value={dashLoading ? '…' : (dashboard?.avgWatchMinutes ?? 0)} icon={Timer} variant="default" />
      </div>

      {/* Mini charts */}
      {!dashLoading && dashboard && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Daily connections bar chart */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-muted mb-3">Son 7 Gün Bağlantı</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dashboard.dailyConnections} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User status pie chart */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-muted mb-3">Kullanıcı Dağılımı</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Aktif', value: dashboard.userStatusDistribution.active },
                    { name: 'Süresi Dolmuş', value: dashboard.userStatusDistribution.expired },
                    { name: 'Banlı', value: dashboard.userStatusDistribution.banned },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Users section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Kullanıcı ara…"
                className="input pl-9 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button type="submit" className="btn-ghost text-sm px-3">Ara</button>
          </form>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setSelectedIds([]); }}
            className="input text-sm w-36"
          >
            <option value="">Tüm Durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DISABLED">Pasif</option>
            <option value="BANNED">Banlı</option>
          </select>
        </div>

        {/* Bulk action toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-sm text-primary font-medium">{selectedIds.length} seçili</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Uzat:</span>
                <input
                  type="number" min={1} max={3650} value={bulkDays}
                  onChange={(e) => setBulkDays(+e.target.value)}
                  className="input w-16 text-xs py-1"
                />
                <span className="text-xs text-muted">gün</span>
                <button
                  onClick={() => void handleBulk('extend')}
                  disabled={bulkAction.isPending}
                  className="text-xs px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
                >
                  Uzat
                </button>
              </div>
              <button
                onClick={() => void handleBulk('suspend')}
                disabled={bulkAction.isPending}
                className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
              >
                Askıya Al
              </button>
              <button
                onClick={() => void handleBulk('activate')}
                disabled={bulkAction.isPending}
                className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/40 hover:bg-blue-500/30 transition-colors"
              >
                Aktifleştir
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-muted hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="card overflow-hidden">
          {usersLoading ? (
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
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted">Kullanıcı</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted">Durum</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted">Son Tarih</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted">Bağlantı</th>
                    <th className="px-4 py-3 w-20" />
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
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleOne(u.id)}
                            className="w-3.5 h-3.5 accent-primary"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">{u.username}</td>
                        <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs', dl < 7 ? 'text-danger' : dl < 30 ? 'text-warning' : 'text-muted')}>
                            {formatDate(u.expiresAt)}
                            <span className="ml-1 opacity-70">({dl}g)</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {u._count?.connections ?? 0}/{u.maxConnections}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setDetailUser(u)}
                            className="text-xs text-muted hover:text-fg px-2 py-1 rounded hover:bg-surface-2 transition-colors"
                          >
                            Detay
                          </button>
                        </td>
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
          <div className="flex items-center justify-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => { setPage((p) => p - 1); setSelectedIds([]); }}
              className="btn-ghost p-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-muted">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); setSelectedIds([]); }}
              className="btn-ghost p-1.5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Create Modal */}
      {showQuickCreate && (
        <QuickCreateModal onClose={() => setShowQuickCreate(false)} credits={credits} />
      )}

      {/* User Detail Drawer */}
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
