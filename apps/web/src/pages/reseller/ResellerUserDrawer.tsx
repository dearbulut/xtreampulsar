import { useState, useCallback } from 'react';
import {
  X, Copy, Check, CalendarPlus, Ban, Trash2, Key, ExternalLink, ListVideo,
} from 'lucide-react';
import {
  useResellerUpdateUser,
  useResellerDeleteUser,
  useResellerResetPassword,
  useResellerUserPlaylists,
} from '@/hooks/useResellerPanel';
import type { ResellerUserRow } from '@/hooks/useResellerPanel';
import { useSettings } from '@/hooks/useSettings';
import { cn, daysLeft, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const EXTEND_PRESETS = [
  { label: '1 Ay', days: 30 },
  { label: '3 Ay', days: 90 },
  { label: '6 Ay', days: 180 },
  { label: '1 Yıl', days: 365 },
] as const;

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

function UrlRow({
  label, value, copiedKey, onCopy,
}: {
  label: string;
  value: string;
  copiedKey: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
      <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
        <span className="font-mono text-xs text-muted truncate flex-1">{value}</span>
        <button onClick={() => onCopy(value, label)} className="shrink-0 text-muted hover:text-fg">
          {copiedKey === label ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-fg">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export function ResellerUserDrawer({
  user,
  onClose,
  onUpdated,
}: {
  user: ResellerUserRow;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [extendDays, setExtendDays] = useState(30);
  const [currentStatus, setCurrentStatus] = useState(user.status);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const settings = useSettings();
  const updateUser = useResellerUpdateUser();
  const deleteUser = useResellerDeleteUser();
  const resetPassword = useResellerResetPassword();
  const { data: playlists } = useResellerUserPlaylists(user.id);

  const xtreamPort = settings?.xtream?.port ?? 25461;
  const rawUrl = settings?.general?.serverUrl?.trim() ?? '';
  const xtreamHost = rawUrl
    ? rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0]
    : window.location.hostname;
  const xtreamBase = `http://${xtreamHost}:${xtreamPort}`;

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Kopyalandı');
  }, []);

  const handleExtend = async () => {
    const base = new Date(Math.max(new Date(user.expiresAt).getTime(), Date.now()));
    await updateUser.mutateAsync({ id: user.id, expiresAt: new Date(base.getTime() + extendDays * 86_400_000).toISOString() });
    toast.success(`${extendDays} gün uzatıldı`);
    onUpdated();
  };

  const handleToggleStatus = async () => {
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    await updateUser.mutateAsync({ id: user.id, status: newStatus });
    setCurrentStatus(newStatus);
    onUpdated();
  };

  const handleDelete = async () => {
    await deleteUser.mutateAsync(user.id);
    onClose();
    onUpdated();
  };

  const handleResetPassword = async () => {
    const result = await resetPassword.mutateAsync(user.id);
    setNewPassword(result.password);
  };

  const dl = daysLeft(user.expiresAt);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-[100vw] z-50 bg-[var(--surface,#111)] border-l border-border flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-semibold text-slate-100">{user.username}</span>
            <StatusBadge status={currentStatus} />
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg p-1.5 rounded-lg hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Info rows */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Oluşturulma</span>
              <span className="text-slate-100">{user.createdAt ? formatDate(user.createdAt) : '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Bitiş Tarihi</span>
              <span className={cn('font-medium', dl < 0 ? 'text-danger' : dl < 7 ? 'text-warning' : 'text-slate-100')}>
                {formatDate(user.expiresAt)}
                <span className="ml-1 text-xs text-slate-400">
                  {dl < 0 ? '(Süresi dolmuş)' : `(${dl}g kaldı)`}
                </span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Max Bağlantı</span>
              <span className="text-slate-100">{user.maxConnections ?? '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Aktif Bağlantı</span>
              <span className="text-slate-100">{String(user._count?.connections ?? 0)}</span>
            </div>
          </div>

          <hr className="border-border" />

          {/* Stream bilgileri */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Stream Bilgileri</span>
              <button
                onClick={() => void handleResetPassword()}
                disabled={resetPassword.isPending}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                <Key className="w-3 h-3" />
                {resetPassword.isPending ? 'Sıfırlanıyor…' : 'Şifre Sıfırla'}
              </button>
            </div>

            {newPassword ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-xs text-emerald-400">Yeni Şifre</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm text-slate-100">{newPassword}</span>
                    <button onClick={() => copy(newPassword, 'password')} className="text-muted hover:text-fg">
                      {copiedKey === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <UrlRow
                  label="M3U URL"
                  value={`${xtreamBase}/get.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(newPassword)}&type=m3u_plus`}
                  copiedKey={copiedKey}
                  onCopy={copy}
                />
                <UrlRow
                  label="Player API"
                  value={`${xtreamBase}/player_api.php?username=${encodeURIComponent(user.username)}&password=${encodeURIComponent(newPassword)}`}
                  copiedKey={copiedKey}
                  onCopy={copy}
                />
              </div>
            ) : (
              <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2.5">
                Şifre sıfırlandıktan sonra M3U ve API URL'leri burada görünecek.
              </p>
            )}
          </div>

          <hr className="border-border" />

          {/* Süre Uzat */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">Süre Uzat</span>
            <div className="flex flex-wrap gap-1.5">
              {EXTEND_PRESETS.map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setExtendDays(days)}
                  className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                    extendDays === days
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted hover:border-primary/40')}
                >
                  {label}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={1} max={3650} value={extendDays}
                  onChange={(e) => setExtendDays(+e.target.value)}
                  className="input w-16 text-xs py-1"
                />
                <span className="text-xs text-muted">gün</span>
              </div>
            </div>
            <button
              onClick={() => void handleExtend()}
              disabled={updateUser.isPending}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CalendarPlus className="w-4 h-4" /> Uzat
            </button>
          </div>

          <hr className="border-border" />

          {/* Askıya Al / Sil */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">İşlemler</span>
            <div className="flex gap-2">
              <button
                onClick={() => void handleToggleStatus()}
                disabled={updateUser.isPending}
                className={cn('flex-1 text-sm py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50',
                  currentStatus === 'ACTIVE'
                    ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                    : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10')}
              >
                <Ban className="w-3.5 h-3.5" />
                {currentStatus === 'ACTIVE' ? 'Askıya Al' : 'Aktifleştir'}
              </button>

              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 text-sm py-2 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Sil
                </button>
              ) : (
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleteUser.isPending}
                  className="flex-1 text-sm py-2 rounded-lg bg-danger/20 border border-danger text-danger font-semibold disabled:opacity-50"
                >
                  {deleteUser.isPending ? 'Siliniyor…' : 'Evet, Sil'}
                </button>
              )}
            </div>
            {confirmDelete && (
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted hover:text-fg w-full text-center">
                İptal
              </button>
            )}
          </div>

          {/* Playlist'ler */}
          {playlists && playlists.length > 0 && (
            <>
              <hr className="border-border" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-muted" />
                  <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                    Playlist'ler ({playlists.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {playlists.map((pl) => (
                    <div key={pl.id} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2">
                      <div className="min-w-0">
                        <span className="text-sm text-slate-300 truncate block">{pl.name}</span>
                        <span className={cn('text-[10px] px-1 py-0.5 rounded',
                          pl.isActive ? 'text-emerald-400' : 'text-slate-400')}>
                          {pl.isActive ? 'Aktif' : 'Pasif'} · {pl.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-300 shrink-0 ml-2">{pl.accessCount} erişim</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
