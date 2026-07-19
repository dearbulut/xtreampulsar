import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Tv2, Radio, KeyRound, Copy, Check, Eye, EyeOff,
  CalendarClock, Users, Clock, Wifi, ListVideo, MessageSquareWarning, Send,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import {
  useClientMe,
  useClientConnections,
  useClientChangePassword,
  useCreateClientRequest,
  useMyClientRequests,
  type ClientConnection,
} from '@/hooks/useClientPanel';
import { cn, daysLeft, formatDate, copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-400',
    DISABLED: 'bg-slate-500/15 text-slate-400',
    BANNED: 'bg-red-500/15 text-red-400',
    EXPIRED: 'bg-amber-500/15 text-amber-400',
  };
  const labelMap: Record<string, string> = {
    ACTIVE: t('client.statusActive'),
    DISABLED: t('client.statusDisabled'),
    BANNED: t('client.statusBanned'),
    EXPIRED: t('client.statusExpired'),
  };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded font-medium', map[status] ?? 'bg-surface-2 text-muted')}>
      {labelMap[status] ?? status}
    </span>
  );
}

// durationSeconds → dk:sn (saat varsa sa:dk:sn)
function formatDurationSecs(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="flex items-center gap-2 text-xs text-muted">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <span className="text-sm text-slate-200">{children}</span>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success(t('client.copied'));
  };
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
      <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
        <span className="font-mono text-xs text-muted truncate flex-1">{value}</span>
        <button onClick={copy} className="shrink-0 text-muted hover:text-fg">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-fg">
          <ListVideo className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

// ─── Subscription card ───────────────────────────────────────────────────────

function SubscriptionCard() {
  const { t } = useTranslation();
  const { data: me, isLoading } = useClientMe();

  if (isLoading || !me) {
    return <div className="card p-5 text-sm text-muted">{t('common.loading')}</div>;
  }

  const dl = daysLeft(me.expiresAt);
  const expired = dl < 0 || me.status === 'EXPIRED';

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Tv2 className="w-4 h-4 text-primary" />
          {t('client.subscription')}
        </h2>
        <div className="flex items-center gap-2">
          {me.isTrial && (
            <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-500/15 text-blue-400">{t('client.trial')}</span>
          )}
          <StatusBadge status={me.status} />
        </div>
      </div>

      <div>
        <InfoRow icon={CalendarClock} label={t('client.expiry')}>
          {expired ? (
            <span className="text-danger font-medium">{t('client.expired')}</span>
          ) : (
            <span>
              {formatDate(me.expiresAt)}
              <span className={cn('ml-1.5 text-xs', dl < 7 ? 'text-danger' : dl < 30 ? 'text-warning' : 'text-muted')}>
                ({t('client.daysLeft', { days: dl })})
              </span>
            </span>
          )}
        </InfoRow>
        <InfoRow icon={Wifi} label={t('client.activeConnections')}>
          <span className="font-mono">{me.activeConnections} / {me.maxConnections}</span>
        </InfoRow>
        <InfoRow icon={Users} label={t('client.maxConnections')}>
          <span className="font-mono">{me.maxConnections}</span>
        </InfoRow>
        <InfoRow icon={Clock} label={t('client.createdAt')}>
          {formatDate(me.createdAt)}
        </InfoRow>
      </div>
    </div>
  );
}

// ─── Playlist card ───────────────────────────────────────────────────────────

function PlaylistCard() {
  const { t } = useTranslation();
  const { data: me } = useClientMe();
  const storedPassword = useAuthStore((s) => s.clientPassword);
  const [pw, setPw] = useState(storedPassword ?? '');
  const [showPw, setShowPw] = useState(false);

  const u = me?.username ?? '';
  const base = me ? `${me.serverUrl}:${me.serverPort}` : '';
  const ready = !!me && !!pw;

  const urls = ready
    ? {
        m3u: `${base}/get.php?username=${u}&password=${pw}&type=m3u_plus`,
        player: `${base}/player_api.php?username=${u}&password=${pw}`,
        epg: `${base}/xmltv.php?username=${u}&password=${pw}`,
      }
    : null;

  return (
    <div className="card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ListVideo className="w-4 h-4 text-primary" />
        {t('client.playlist')}
      </h2>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted">{t('client.password')}</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={t('client.playlistPasswordPlaceholder')}
            className="input w-full pr-10 font-mono text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate-300"
          >
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {urls ? (
        <div className="space-y-2">
          <CopyRow label={t('client.m3u')} value={urls.m3u} />
          <CopyRow label={t('client.playerApi')} value={urls.player} />
          <CopyRow label={t('client.epg')} value={urls.epg} />
        </div>
      ) : (
        <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2.5">
          {t('client.enterPasswordHint')}
        </p>
      )}
    </div>
  );
}

// ─── Active connections card ─────────────────────────────────────────────────

function ConnectionsCard() {
  const { t } = useTranslation();
  const { data: connections = [], isLoading } = useClientConnections();

  return (
    <div className="card p-5 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Radio className="w-4 h-4 text-primary" />
        {t('client.activeConnectionsTitle')}
        {connections.length > 0 && (
          <span className="text-xs text-muted font-normal">({connections.length})</span>
        )}
      </h2>

      {isLoading ? (
        <div className="text-sm text-muted py-4 text-center">{t('common.loading')}</div>
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted">
          <Wifi className="w-7 h-7 opacity-30" />
          <p className="text-sm">{t('client.noConnections')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-2 py-2 text-xs font-medium text-muted">IP</th>
                <th className="text-left px-2 py-2 text-xs font-medium text-muted">{t('client.channel')}</th>
                <th className="text-right px-2 py-2 text-xs font-medium text-muted">{t('client.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c: ClientConnection) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-2 font-mono text-xs text-slate-300">{c.ip}</td>
                  <td className="px-2 py-2 text-slate-300">{c.stream?.name ?? '—'}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-muted">
                    {formatDurationSecs(c.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Change password card ────────────────────────────────────────────────────

function ChangePasswordCard() {
  const { t } = useTranslation();
  const changePassword = useClientChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      // Playlist URL'lerinin taze şifreyle çalışması için bellekteki şifreyi güncelle.
      useAuthStore.setState({ clientPassword: newPassword });
      toast.success(t('client.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      // hata toast'ı hook onError'da gösteriliyor
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <KeyRound className="w-4 h-4 text-primary" />
        {t('client.changePassword')}
      </h2>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">{t('client.currentPassword')}</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input w-full"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">{t('client.newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input w-full"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <button
          type="submit"
          disabled={changePassword.isPending || !currentPassword || !newPassword}
          className="btn-primary w-full text-sm"
        >
          {changePassword.isPending ? t('client.saving') : t('client.changePasswordBtn')}
        </button>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function RequestCard() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'REPORT' | 'NEW_CHANNEL'>('REPORT');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const create = useCreateClientRequest();
  const { data: myReqs = [] } = useMyClientRequests();

  const submit = () => {
    if (!title.trim()) return;
    create.mutate(
      { type: mode, title: title.trim(), message: message.trim() || undefined },
      { onSuccess: () => { setTitle(''); setMessage(''); toast.success(t('client.requestSent')); } },
    );
  };

  return (
    <div className="card p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <MessageSquareWarning className="w-4 h-4 text-primary" />
        {t('client.myRequests')}
      </h2>
      <div className="flex gap-1">
        <button onClick={() => setMode('REPORT')} className={cn('flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors', mode === 'REPORT' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>{t('client.reportProblem')}</button>
        <button onClick={() => setMode('NEW_CHANNEL')} className={cn('flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors', mode === 'NEW_CHANNEL' ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>{t('client.requestChannel')}</button>
      </div>
      <p className="text-xs text-muted">{mode === 'REPORT' ? t('client.reportProblemDesc') : t('client.requestChannelDesc')}</p>
      <input
        className="input"
        placeholder={mode === 'REPORT' ? t('client.problemChannel') : t('client.channelName')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input min-h-16 resize-none"
        placeholder={t('client.details')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        className="btn-primary w-full flex items-center justify-center gap-2"
        disabled={!title.trim() || create.isPending}
        onClick={submit}
      >
        <Send className="w-4 h-4" />{t('client.send')}
      </button>
      {myReqs.length > 0 ? (
        <div className="space-y-1.5 pt-3 border-t border-border">
          {myReqs.slice(0, 5).map((r) => (
            <div key={r.id} className="text-xs pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-muted">
                  {r.type === 'REPORT' ? '⚠ ' : '＋ '}{r.stream?.name ? `${r.stream.name} — ` : ''}{r.title}
                </span>
                <span className={cn('shrink-0', r.status === 'RESOLVED' ? 'text-success' : r.status === 'REJECTED' ? 'text-danger' : 'text-warning')}>
                  {t(`clientRequests.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`)}
                </span>
              </div>
              {r.adminNote && (
                <div className="mt-1 flex gap-1.5 text-primary bg-primary/5 rounded px-2 py-1.5">
                  <span className="shrink-0">↳</span>
                  <span className="whitespace-pre-wrap break-words">{r.adminNote}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted text-center pt-2">{t('client.noRequests')}</p>
      )}
    </div>
  );
}

export function ClientDashboardPage() {
  const { t } = useTranslation();
  const clientUser = useAuthStore((s) => s.clientUser);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">
          {t('client.welcome')}, <span className="text-primary">{clientUser?.username}</span>
        </h1>
        <p className="text-sm text-muted">{t('client.panelSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubscriptionCard />
        <PlaylistCard />
        <ConnectionsCard />
        <ChangePasswordCard />
        <RequestCard />
      </div>
    </div>
  );
}
