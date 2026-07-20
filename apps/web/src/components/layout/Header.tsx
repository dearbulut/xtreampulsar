import { Bell, ChevronDown, User, Settings, LogOut, Download, X, ExternalLink, Palette, Menu, Search, Radio, UserCircle, Cpu, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { LANGUAGES } from '@/i18n/i18n';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useRouter } from '@tanstack/react-router';
import { useUpdateCheck, useApplyUpdate } from '@/hooks/useUpdate';
import { cn } from '@/lib/utils';
import { THEMES, THEME_LABELS, type ThemeName } from '@/styles/themes';
import api from '@/lib/axios';

interface NotificationLog {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  messageKey?: string | null;
  messageParams?: Record<string, unknown> | null;
  status: 'SENT' | 'FAILED' | 'PENDING';
  isRead: boolean;
  createdAt: string;
}

function useNotificationLogs() {
  return useQuery<NotificationLog[]>({
    queryKey: ['notification-logs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { items: NotificationLog[] } }>('/notifications/logs?limit=10');
      return res.data.data?.items ?? [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

function useUnreadCount() {
  return useQuery<number>({
    queryKey: ['notification-unread'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { count: number } }>('/notifications/unread-count');
      return res.data.data?.count ?? 0;
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notification-unread'] });
      void qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
  });
}

function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notification-unread'] });
      void qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
  });
}

function relativeTime(dateStr: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t('layout.justNow');
  if (mins < 60) return t('layout.minutesAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('layout.hoursAgo', { n: hrs });
  return t('layout.daysAgo', { n: Math.floor(hrs / 24) });
}

function notifIcon(type: string) {
  if (type?.includes('STREAM') || type?.includes('STREAM_FAIL')) {
    return <Radio className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />;
  }
  if (type?.includes('USER') || type?.includes('LOGIN') || type?.includes('EXPIR')) {
    return <UserCircle className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />;
  }
  return <Cpu className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />;
}

interface Props {
  title?: string;
  breadcrumb?: string[];
}

const THEME_ORDER: ThemeName[] = ['dark', 'light', 'midnight', 'ocean', 'forest', 'sunset'];

interface SearchResults {
  users: { id: string; username: string; status: string; role: string }[];
  streams: { id: string; name: string; status: string; tvgLogo?: string; externalId: number; category?: { name: string; type: string } }[];
  resellers: { id: string; username: string; email: string; tier: string }[];
  categories: { id: string; name: string; type: string; _count?: { streams: number } }[];
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults(null); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ success: boolean; data: SearchResults }>(
          `/search?q=${encodeURIComponent(q)}&types=users,streams,resellers,categories`,
        );
        setResults(res.data?.data ?? null);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  const navigate = useCallback((to: string) => {
    void router.navigate({ to: to as Parameters<typeof router.navigate>[0]['to'] });
    onClose();
  }, [router, onClose]);

  const hasResults = !!results && (
    (results.users?.length ?? 0) + (results.streams?.length ?? 0) +
    (results.resellers?.length ?? 0) + (results.categories?.length ?? 0)
  ) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            placeholder={t('layout.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
          {loading && <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin flex-shrink-0" />}
          <button onClick={onClose} className="text-muted hover:text-fg flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {!q.trim() && (
            <div className="p-6 text-center text-muted text-sm">
              {t('layout.searchStartTyping')}
            </div>
          )}

          {q.trim() && !loading && !hasResults && (
            <div className="p-6 text-center text-muted text-sm">
              {t('layout.searchNoResults', { q })}
            </div>
          )}

          {results?.users && results.users.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest bg-surface-2/50">{t('nav.users')}</div>
              {results.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => navigate('/users')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{u.username[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-mono">{u.username}</div>
                    <div className="text-xs text-muted">{u.role} · {u.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results?.streams && results.streams.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest bg-surface-2/50">{t('nav.channels')}</div>
              {results.streams.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate('/streams')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  {s.tvgLogo ? (
                    <img src={s.tvgLogo} alt="" className="w-7 h-7 object-contain rounded flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-7 h-7 rounded bg-surface-2 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{s.name}</div>
                    <div className="text-xs text-muted">{s.category?.name} · #{s.externalId}</div>
                  </div>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded flex-shrink-0', s.status === 'ONLINE' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger')}>
                    {s.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results?.resellers && results.resellers.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest bg-surface-2/50">{t('layout.resellers')}</div>
              {results.resellers.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate('/resellers')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-warning">{r.username[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200">{r.username}</div>
                    <div className="text-xs text-muted">{r.email} · {r.tier}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results?.categories && results.categories.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-semibold text-muted uppercase tracking-widest bg-surface-2/50">{t('nav.categories')}</div>
              {results.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate('/categories')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-purple-400">{c.type[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200">{c.name}</div>
                    <div className="text-xs text-muted">{c.type} · {t('layout.channelCount', { n: c._count?.streams ?? 0 })}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted">
          <span>{t('layout.enterToSelect')}</span>
          <span>{t('layout.escToClose')}</span>
        </div>
      </div>
    </div>
  );
}

export function Header({ title, breadcrumb }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { data: notifLogs = [] } = useNotificationLogs();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const { t, i18n } = useTranslation();

  const changeLanguage = (code: string) => {
    void i18n.changeLanguage(code);
    localStorage.setItem('xp-lang', code);
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
  };

  const { data: updateInfo } = useUpdateCheck();
  const applyUpdate = useApplyUpdate();

  const hasUpdate = updateInfo?.hasUpdate && !bannerDismissed;

  const handleLogout = () => {
    logout();
    void router.navigate({ to: '/login' });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex-shrink-0">
      {/* Update banner */}
      {hasUpdate && (
        <div className="bg-indigo-600/90 text-white text-xs px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {t('layout.newVersionAvailable')} <strong>v{updateInfo?.latestVersion}</strong>
              {' '}&mdash; {t('layout.currentVersion')} v{updateInfo?.currentVersion}
            </span>
            <button
              onClick={() => setShowNotes(true)}
              className="underline underline-offset-2 hover:text-indigo-200 transition-colors"
            >
              {t('layout.notes')}
            </button>
            <a
              href={updateInfo?.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 underline underline-offset-2 hover:text-indigo-200"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyUpdate.mutate()}
              disabled={applyUpdate.isPending}
              className="bg-white text-indigo-700 font-semibold px-3 py-0.5 rounded-md hover:bg-indigo-50 transition text-xs disabled:opacity-60"
            >
              {applyUpdate.isPending ? t('layout.updating') : t('common.update')}
            </button>
            <button onClick={() => setBannerDismissed(true)} className="p-0.5 hover:text-indigo-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-5">
        {/* Mobile hamburger + Breadcrumb */}
        <div className="flex items-center gap-3 text-sm">
          <button
            className="md:hidden p-2 rounded-lg text-muted hover:bg-surface-2 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            {breadcrumb ? (
              breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted">/</span>}
                  <span className={cn(i === breadcrumb.length - 1 ? 'font-medium' : 'text-muted')}>
                    {crumb}
                  </span>
                </span>
              ))
            ) : (
              <span className="font-medium">{title}</span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {/* Global search button */}
          <button
            onClick={() => setShowSearch(true)}
            title={t('layout.searchTooltip')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-muted hover:bg-surface-2 transition-colors text-sm"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline text-xs">{t('common.search')}</span>
            <kbd className="hidden md:inline text-[10px] bg-surface-2 border border-border px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </button>

          {/* Theme picker dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title={t('layout.selectTheme')}
                className="p-2 rounded-lg text-muted hover:bg-surface-2 transition-all duration-200 flex items-center gap-1.5"
              >
                <Palette className="w-4 h-4" />
                <span
                  className="w-3 h-3 rounded-full border border-border hidden sm:block"
                  style={{ background: THEMES[theme].primary }}
                />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="bg-surface border border-border rounded-xl shadow-2xl p-2 min-w-44 z-50 animate-fade-in"
                align="end"
                sideOffset={6}
              >
                <div className="text-[10px] text-muted px-2 pb-1.5 uppercase tracking-widest font-semibold">{t('layout.theme')}</div>
                {THEME_ORDER.map((t) => (
                  <DropdownMenu.Item
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm cursor-pointer outline-none transition-colors',
                      t === theme ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                      style={{ background: THEMES[t].primary }}
                    />
                    {THEME_LABELS[t]}
                    {t === theme && <span className="ml-auto text-[10px] text-primary">✓</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Language picker */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button title={t('layout.selectLanguage')} className="p-2 rounded-lg text-muted hover:bg-surface-2 transition-all duration-200 flex items-center gap-1">
                <Globe className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">{LANGUAGES.find((l) => l.code === i18n.language)?.flag ?? '🌐'}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="bg-surface border border-border rounded-xl shadow-2xl p-2 min-w-36 z-50 animate-fade-in" align="end" sideOffset={6}>
                <div className="text-[10px] text-muted px-2 pb-1.5 uppercase tracking-widest font-semibold">{t('layout.languageHeader')}</div>
                {LANGUAGES.map((lang) => (
                  <DropdownMenu.Item
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer outline-none transition-colors',
                      i18n.language === lang.code ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {i18n.language === lang.code && <span className="ml-auto text-[10px] text-primary">✓</span>}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Notification bell */}
          <DropdownMenu.Root onOpenChange={(open) => { if (open && unreadCount > 0) markAllRead.mutate(); }}>
            <DropdownMenu.Trigger asChild>
              <button className="relative p-2 text-muted hover:bg-surface-2 rounded-lg transition-colors">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="bg-surface border border-border rounded-xl shadow-2xl p-1.5 w-80 z-50 animate-fade-in"
                align="end"
                sideOffset={6}
              >
                <div className="text-[10px] text-muted px-2 pb-1.5 uppercase tracking-widest font-semibold flex items-center justify-between">
                  <span>{t('layout.notifications')} {unreadCount > 0 && <span className="ml-1 text-danger">({unreadCount})</span>}</span>
                  <button
                    onClick={() => void router.navigate({ to: '/settings' })}
                    className="hover:text-primary transition-colors normal-case text-[10px]"
                  >
                    {t('layout.viewAll')}
                  </button>
                </div>
                {notifLogs.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted">{t('layout.noNotifications')}</div>
                ) : (
                  notifLogs.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                      className={cn(
                        'w-full flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors text-left',
                        !n.isRead && 'bg-primary/5',
                      )}
                    >
                      {notifIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-xs truncate', n.isRead ? 'text-muted' : 'text-slate-200 font-medium')}>{n.messageKey ? t(`notif.${n.messageKey}`, { ...(n.messageParams ?? {}), defaultValue: n.subject }) : n.subject}</div>
                        <div className="text-[11px] text-muted truncate">{n.recipient}</div>
                        <div className="text-[10px] text-muted/60 mt-0.5">{relativeTime(n.createdAt, t)}</div>
                      </div>
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </button>
                  ))
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* User dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors text-sm">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-primary">
                    {user?.username?.[0]?.toUpperCase() ?? 'A'}
                  </span>
                </div>
                <span className="font-medium hidden sm:block">{user?.username}</span>
                <ChevronDown className="w-3 h-3 text-muted" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="bg-surface border border-border rounded-xl shadow-2xl p-1.5 min-w-44 z-50 animate-fade-in"
                align="end"
                sideOffset={6}
              >
                <div className="px-3 py-2 border-b border-border mb-1">
                  <div className="text-xs font-medium">{user?.username}</div>
                  <div className="text-[11px] text-muted">{user?.role}</div>
                </div>
                <DropdownItem icon={User} label={t('layout.profile')} onClick={() => void router.navigate({ to: '/profile' })} />
                <DropdownItem icon={Settings} label={t('nav.settings')} onClick={() => void router.navigate({ to: '/settings' })} />
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownItem icon={LogOut} label={t('layout.logout')} danger onClick={handleLogout} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Release notes modal */}
      {showNotes && updateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNotes(false)}>
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">v{updateInfo.latestVersion} — {t('layout.releaseNotes')}</h2>
              <button onClick={() => setShowNotes(false)} className="text-muted hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="text-sm text-muted whitespace-pre-wrap max-h-80 overflow-y-auto font-mono leading-relaxed">
              {updateInfo.releaseNotes || t('layout.noReleaseNotes')}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                {t('layout.viewOnGithub')} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Global search overlay */}
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </div>
  );
}

function DropdownItem({ icon: Icon, label, danger, onClick }: { icon: React.ElementType; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <DropdownMenu.Item
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors',
        danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:text-fg hover:bg-surface-2',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </DropdownMenu.Item>
  );
}
