import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import {
  Tv2, LayoutDashboard, Users, LogOut, CreditCard, Settings, Network,
  Bell, CreditCard as CreditIcon, Clock, CheckCheck, X,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { useLocation } from '@tanstack/react-router';
import {
  useResellerMe,
  useResellerUnreadCount,
  useResellerNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type ResellerNotification,
} from '@/hooks/useResellerPanel';

const NAV = [
  { to: '/reseller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reseller/users', label: 'Kullanıcılar', icon: Users },
  { to: '/reseller/sub-resellers', label: 'Alt Bayilerim', icon: Network },
  { to: '/reseller/credits', label: 'Kredi Hareketleri', icon: CreditCard },
  { to: '/reseller/profile', label: 'Profil / Ayarlar', icon: Settings },
];

// ─── Relative time helper ────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}

// ─── Notification icon by type ───────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  if (type === 'LOW_CREDIT') {
    return (
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
        <CreditIcon className="w-4 h-4 text-amber-400" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
      <Clock className="w-4 h-4 text-blue-400" />
    </div>
  );
}

// ─── Notification dropdown ───────────────────────────────────────────────────

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const { data: notifications = [], isLoading } = useResellerNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const recent = notifications.slice(0, 10);

  const handleClick = (n: ResellerNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-slate-200">Bildirimler</span>
        <div className="flex items-center gap-2">
          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tümünü okundu işaretle
            </button>
          )}
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted">Yükleniyor…</div>
        ) : recent.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">Bildirim yok</p>
          </div>
        ) : (
          recent.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-surface-2',
                !n.isRead && 'bg-primary/5',
              )}
            >
              <NotifIcon type={n.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('text-sm font-medium leading-tight', n.isRead ? 'text-slate-400' : 'text-slate-200')}>
                    {n.title}
                  </span>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
                <span className="text-[11px] text-muted/60 mt-1 block">{timeAgo(n.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {notifications.length === 0 ? null : (
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted/60 text-center">
          Son {Math.min(notifications.length, 10)} bildirim gösteriliyor
        </div>
      )}
    </div>
  );
}

// ─── Bell button ─────────────────────────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: count = 0 } = useResellerUnreadCount();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          open ? 'bg-primary/15 text-primary' : 'text-muted hover:text-slate-300 hover:bg-surface-2',
        )}
        aria-label="Bildirimler"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function ResellerLayout() {
  const navigate = useNavigate();
  const resellerUser = useAuthStore((s) => s.resellerUser);
  const resellerLogout = useAuthStore((s) => s.resellerLogout);
  const location = useLocation();
  const { data: me } = useResellerMe();

  const handleLogout = () => {
    resellerLogout();
    void navigate({ to: '/reseller/login' });
  };

  const brandName = me?.brandName || 'Bayi Paneli';
  const logoUrl = me?.logoUrl ?? null;
  const primaryColor = me?.primaryColor ?? null;
  const brandingStyle = primaryColor
    ? ({ '--color-primary': primaryColor } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen flex bg-background" style={brandingStyle}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-6 h-6 rounded object-contain" />
            ) : (
              <Tv2 className="w-5 h-5 text-primary" />
            )}
            <span className="font-bold text-slate-100 text-sm">{brandName}</span>
          </div>
          {resellerUser && (
            <div className="mt-2 text-xs text-muted">
              <div className="text-slate-300 font-medium">{resellerUser.username}</div>
              <div>Kredi: <span className="text-primary">{resellerUser.credits}</span></div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                location.pathname === to || location.pathname.startsWith(to + '/')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-slate-300 hover:bg-surface-2',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-border flex items-center justify-end px-6 gap-3 flex-shrink-0 bg-background/80 backdrop-blur">
          <NotificationBell />
        </header>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
