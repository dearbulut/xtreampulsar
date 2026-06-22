import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Server,
  Tv,
  Film,
  Clapperboard,
  FolderOpen,
  BookMarked,
  Users,
  UserCircle,
  Radio,
  Package,
  ArrowRightLeft,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui.store';
import { useAuthStore } from '@/store/auth.store';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'hot' | 'count';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: 'GENEL',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Canlı Bağlantılar', to: '/live-connections', icon: Activity },
    ],
  },
  {
    label: 'SUNUCULAR',
    items: [
      { label: 'Sunucular', to: '/servers', icon: Server },
    ],
  },
  {
    label: 'İÇERİK',
    items: [
      { label: 'Kanallar', to: '/channels', icon: Tv },
      { label: 'VOD', to: '/vod', icon: Film },
      { label: 'Diziler', to: '/series', icon: Clapperboard },
      { label: 'Kategoriler', to: '/categories', icon: FolderOpen },
      { label: "Bouquet'lar", to: '/bouquets', icon: BookMarked },
    ],
  },
  {
    label: 'KULLANICILAR',
    items: [
      { label: 'Kullanıcılar', to: '/users', icon: Users, badge: 'HOT', badgeVariant: 'hot' },
      { label: "Reseller'lar", to: '/resellers', icon: UserCircle },
    ],
  },
  {
    label: 'EPG',
    items: [
      { label: 'EPG Kaynakları', to: '/epg', icon: Radio },
    ],
  },
  {
    label: 'YÖNETİM',
    items: [
      { label: 'Paketler', to: '/packages', icon: Package },
      { label: 'Migration', to: '/migration', icon: ArrowRightLeft },
      { label: 'Güvenlik', to: '/security', icon: Shield },
      { label: 'Ayarlar', to: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-border transition-all duration-200 flex-shrink-0 relative',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 glow-primary">
            <Zap className="w-4 h-4 text-white animate-pulse-slow" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm text-gradient truncate">XtreamPulsar</span>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-[4.25rem] w-6 h-6 rounded-full bg-sidebar border border-border flex items-center justify-center text-muted hover:text-slate-200 z-10 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-muted/60 tracking-widest uppercase">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-3 flex-shrink-0">
        <div className={cn('flex items-center gap-2', collapsed ? 'justify-center' : '')}>
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-primary">
              {user?.username?.[0]?.toUpperCase() ?? 'A'}
            </span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{user?.username}</div>
                <div className="text-[10px] text-muted">{user?.role}</div>
              </div>
              <button
                onClick={logout}
                className="text-muted hover:text-danger transition-colors p-1"
                title="Çıkış"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="nav-item"
      activeProps={{ className: 'nav-item active' }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded',
                item.badgeVariant === 'hot'
                  ? 'bg-danger/20 text-danger'
                  : 'bg-primary/20 text-primary-light',
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
