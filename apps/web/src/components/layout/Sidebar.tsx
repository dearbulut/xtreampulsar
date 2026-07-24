import { Link } from '@tanstack/react-router';
import {
  Download,
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
  Wrench,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Activity,
  TrendingUp,
  BarChart2,
  CalendarDays,
  Link2,
  Webhook,
  Tablet,
  Bell,
  X,
  MessageSquareWarning,
  Rss,
  Ticket,
  Flame,
  ShoppingBag,
  Receipt,
  Captions,
  HandCoins,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    label: 'nav.groups.general',
    items: [
      { label: 'nav.dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'nav.liveConnections', to: '/live-connections', icon: Activity },
    ],
  },
  {
    label: 'nav.groups.content',
    items: [
      { label: 'nav.channels', to: '/channels', icon: Tv },
      { label: 'nav.vod', to: '/vod', icon: Film },
      { label: 'nav.series', to: '/series', icon: Clapperboard },
      { label: 'nav.subtitles', to: '/subtitles', icon: Captions },
      { label: 'nav.categories', to: '/categories', icon: FolderOpen },
      { label: 'nav.bouquets', to: '/bouquets', icon: BookMarked },
      { label: 'nav.downloads', to: '/downloads', icon: Download },
    ],
  },
  {
    label: 'nav.groups.epg',
    items: [
      { label: 'nav.epgSources', to: '/epg', icon: Radio },
      { label: 'layout.manualMapping', to: '/epg/mappings', icon: Link2 },
      { label: 'nav.epgGuide', to: '/epg/guide', icon: CalendarDays },
    ],
  },
  {
    label: 'nav.groups.customers',
    items: [
      { label: 'nav.users', to: '/users', icon: Users, badge: 'HOT', badgeVariant: 'hot' },
      { label: 'nav.resellers', to: '/resellers', icon: UserCircle },
      { label: 'layout.magDevices', to: '/mag-devices', icon: Tablet },
      { label: 'nav.userReports', to: '/users/report', icon: BarChart2 },
      { label: 'nav.clientRequests', to: '/client-requests', icon: MessageSquareWarning },
      { label: 'nav.activationCodes', to: '/activation-codes', icon: Ticket },
    ],
  },
  {
    label: 'nav.groups.billing',
    items: [
      { label: 'nav.packages', to: '/packages', icon: Package },
      { label: 'nav.invoices', to: '/invoices', icon: Receipt },
      { label: 'nav.commissions', to: '/commissions', icon: HandCoins },
      { label: 'nav.storeOrders', to: '/store-orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'nav.groups.infrastructure',
    items: [
      { label: 'nav.servers', to: '/servers', icon: Server },
      { label: 'nav.systemHealth', to: '/system-health', icon: Activity },
      { label: 'nav.migration', to: '/migration', icon: ArrowRightLeft },
      { label: 'nav.m3uSync', to: '/m3u-sources', icon: Rss },
    ],
  },
  {
    label: 'nav.groups.analytics',
    items: [
      { label: 'nav.mostWatched', to: '/analytics/most-watched', icon: Flame },
      { label: 'nav.revenueReport', to: '/analytics/revenue', icon: TrendingUp },
    ],
  },
  {
    label: 'nav.groups.system',
    items: [
      { label: 'nav.security', to: '/security', icon: Shield },
      { label: 'layout.webhooks', to: '/webhooks', icon: Webhook },
      { label: 'nav.tools', to: '/tools/advanced', icon: Wrench },
      { label: 'layout.supportCenter', to: '/support', icon: Bell },
      { label: 'nav.settings', to: '/settings', icon: Settings },
    ],
  },
];

function SidebarContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar border-r border-border transition-all duration-200 flex-shrink-0 relative',
        collapsed ? 'w-16' : 'w-60',
      )}
      style={{ backgroundColor: 'var(--color-sidebar)' }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 glow-primary">
            <Zap className="w-4 h-4 text-white animate-pulse-slow" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm text-gradient truncate">XtreamPulsar</span>
          )}
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button onClick={onClose} className="text-muted hover:text-fg p-1 ml-2">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Collapse toggle (desktop only) */}
      {!onClose && (
        <button
          onClick={toggle}
          className="absolute -right-3 top-[4.25rem] w-6 h-6 rounded-full bg-sidebar border border-border flex items-center justify-center text-muted hover:text-fg z-10 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-semibold text-muted/60 tracking-widest uppercase">
                {t(group.label)}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.to} item={item} collapsed={collapsed} onNavigate={onClose} />
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
                <div className="text-xs font-medium truncate">{user?.username}</div>
                <div className="text-[10px] text-muted">{user?.role}</div>
              </div>
              <button
                onClick={logout}
                className="text-muted hover:text-danger transition-colors p-1"
                title={t('layout.logout')}
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

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SidebarContent collapsed={collapsed} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50">
            <SidebarContent collapsed={false} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const { t } = useTranslation();
  return (
    <Link
      to={item.to}
      className="nav-item"
      activeProps={{ className: 'nav-item active' }}
      activeOptions={{ exact: true }}
      onClick={onNavigate}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{t(item.label)}</span>
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
