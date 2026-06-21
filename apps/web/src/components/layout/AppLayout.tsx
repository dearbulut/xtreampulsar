import { Outlet, useRouterState } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const ROUTE_TITLES: Record<string, string[]> = {
  '/dashboard': ['Dashboard'],
  '/live-connections': ['Canlı Bağlantılar'],
  '/servers': ['Sunucular'],
  '/channels': ['İçerik', 'Kanallar'],
  '/vod': ['İçerik', 'VOD'],
  '/series': ['İçerik', 'Diziler'],
  '/categories': ['İçerik', 'Kategoriler'],
  '/bouquets': ['İçerik', "Bouquet'lar"],
  '/users': ['Kullanıcılar'],
  '/resellers': ["Reseller'lar"],
  '/epg': ['EPG Kaynakları'],
  '/packages': ['Paketler'],
  '/migration': ['Migration'],
  '/security': ['Güvenlik'],
  '/settings': ['Ayarlar'],
};

export function AppLayout() {
  const location = useRouterState({ select: (s) => s.location });
  const breadcrumb = ROUTE_TITLES[location.pathname] ?? [location.pathname];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header breadcrumb={breadcrumb} />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
