import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import { Tv2, LayoutDashboard, Users, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { useLocation } from '@tanstack/react-router';

const NAV = [
  { to: '/reseller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reseller/users', label: 'Kullanıcılar', icon: Users },
];

export function ResellerLayout() {
  const navigate = useNavigate();
  const resellerUser = useAuthStore((s) => s.resellerUser);
  const resellerLogout = useAuthStore((s) => s.resellerLogout);
  const location = useLocation();

  const handleLogout = () => {
    resellerLogout();
    void navigate({ to: '/reseller/login' });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tv2 className="w-5 h-5 text-primary" />
            <span className="font-bold text-slate-100 text-sm">Bayi Paneli</span>
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

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
