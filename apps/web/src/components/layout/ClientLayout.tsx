import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { Tv2, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export function ClientLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clientUser = useAuthStore((s) => s.clientUser);
  const clientLogout = useAuthStore((s) => s.clientLogout);

  const handleLogout = () => {
    clientLogout();
    void navigate({ to: '/client/login' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <Tv2 className="w-5 h-5 text-primary" />
          <span className="font-bold text-slate-100 text-sm">XtreamPulsar</span>
        </div>
        <div className="flex items-center gap-3">
          {clientUser && (
            <span className="text-sm text-slate-300 font-medium">{clientUser.username}</span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('client.logout')}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
