import { Bell, ChevronDown, User, Settings, LogOut, Download, X, ExternalLink, Palette, Menu } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useRouter } from '@tanstack/react-router';
import { useUpdateCheck, useApplyUpdate } from '@/hooks/useUpdate';
import { cn } from '@/lib/utils';
import { THEMES, THEME_LABELS, type ThemeName } from '@/styles/themes';

interface Props {
  title?: string;
  breadcrumb?: string[];
}

const THEME_ORDER: ThemeName[] = ['dark', 'light', 'midnight', 'ocean', 'forest', 'sunset'];

export function Header({ title, breadcrumb }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const { data: updateInfo } = useUpdateCheck();
  const applyUpdate = useApplyUpdate();

  const hasUpdate = updateInfo?.hasUpdate && !bannerDismissed;

  const handleLogout = () => {
    logout();
    void router.navigate({ to: '/login' });
  };

  return (
    <div className="flex-shrink-0">
      {/* Update banner */}
      {hasUpdate && (
        <div className="bg-indigo-600/90 text-white text-xs px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Yeni sürüm mevcut: <strong>v{updateInfo?.latestVersion}</strong>
              {' '}&mdash; mevcut: v{updateInfo?.currentVersion}
            </span>
            <button
              onClick={() => setShowNotes(true)}
              className="underline underline-offset-2 hover:text-indigo-200 transition-colors"
            >
              Notlar
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
              {applyUpdate.isPending ? 'Güncelleniyor...' : 'Güncelle'}
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
          {/* Theme picker dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="Tema seç"
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
                <div className="text-[10px] text-muted px-2 pb-1.5 uppercase tracking-widest font-semibold">Tema</div>
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

          {/* Notification bell */}
          <button className="relative p-2 text-muted hover:bg-surface-2 rounded-lg transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger" />
          </button>

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
                <DropdownItem icon={User} label="Profilim" />
                <DropdownItem icon={Settings} label="Ayarlar" />
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownItem icon={LogOut} label="Çıkış Yap" danger onClick={handleLogout} />
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
              <h2 className="font-semibold">v{updateInfo.latestVersion} — Sürüm Notları</h2>
              <button onClick={() => setShowNotes(false)} className="text-muted hover:text-fg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="text-sm text-muted whitespace-pre-wrap max-h-80 overflow-y-auto font-mono leading-relaxed">
              {updateInfo.releaseNotes || 'Sürüm notu yok.'}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                GitHub'da Gör <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
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
