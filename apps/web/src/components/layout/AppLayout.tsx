import { Outlet, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const ROUTE_TITLE_KEYS: Record<string, string[]> = {
  '/dashboard': ['nav.dashboard'],
  '/live-connections': ['nav.liveConnections'],
  '/servers': ['nav.servers'],
  '/channels': ['nav.groups.content', 'nav.channels'],
  '/vod': ['nav.groups.content', 'nav.vod'],
  '/series': ['nav.groups.content', 'nav.series'],
  '/categories': ['nav.groups.content', 'nav.categories'],
  '/bouquets': ['nav.groups.content', 'nav.bouquets'],
  '/users': ['nav.users'],
  '/users/report': ['nav.users', 'nav.userReports'],
  '/resellers': ['nav.resellers'],
  '/mag-devices': ['layout.magDevices'],
  '/epg': ['nav.epgSources'],
  '/epg/mappings': ['layout.manualMapping'],
  '/epg/guide': ['nav.epgGuide'],
  '/analytics/revenue': ['nav.revenueReport'],
  '/packages': ['nav.packages'],
  '/migration': ['nav.migration'],
  '/tools/advanced': ['nav.tools'],
  '/security': ['nav.security'],
  '/webhooks': ['layout.webhooks'],
  '/support': ['layout.supportCenter'],
  '/settings': ['nav.settings'],
};

export function AppLayout() {
  const { t } = useTranslation();
  const location = useRouterState({ select: (s) => s.location });
  const keys = ROUTE_TITLE_KEYS[location.pathname];
  const breadcrumb = keys ? keys.map((k) => t(k)) : [location.pathname];

  return (
    <div className="flex h-screen bg-bg overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
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
