import { Bell, ChevronDown, User, Settings, LogOut, Sun, Moon } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';
import { useRouter } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  breadcrumb?: string[];
}

export function Header({ title, breadcrumb }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const handleLogout = () => {
    logout();
    void router.navigate({ to: '/login' });
  };

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-5 flex-shrink-0">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 text-sm">
        {breadcrumb ? (
          breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted">/</span>}
              <span
                className={cn(
                  i === breadcrumb.length - 1 ? 'font-medium' : 'text-muted',
                )}
                style={i === breadcrumb.length - 1 ? { color: 'var(--color-fg)' } : undefined}
              >
                {crumb}
              </span>
            </span>
          ))
        ) : (
          <span className="font-medium" style={{ color: 'var(--color-fg)' }}>{title}</span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Karanlık moda geç' : 'Aydınlık moda geç'}
          className="p-2 rounded-lg text-muted hover:bg-surface-2 transition-all duration-200"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 transition-transform duration-200" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-200 rotate-12" />
          )}
        </button>

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
              <span className="font-medium hidden sm:block" style={{ color: 'var(--color-fg)' }}>
                {user?.username}
              </span>
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
                <div className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                  {user?.username}
                </div>
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
  );
}

function DropdownItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
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
