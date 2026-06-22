import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { StreamsPage } from '@/pages/streams/StreamsPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { ResellersPage } from '@/pages/resellers/ResellersPage';
import { LiveConnectionsPage } from '@/pages/live-connections/LiveConnectionsPage';
import { ServersPage } from '@/pages/servers/ServersPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { BouquetsPage } from '@/pages/bouquets/BouquetsPage';
import { EPGSourcesPage } from '@/pages/epg/EPGSourcesPage';
import { EPGMassAssignPage } from '@/pages/epg/EPGMassAssignPage';
import { PackagesPage } from '@/pages/packages/PackagesPage';
import { MigrationPage } from '@/pages/migration/MigrationPage';
import { SecurityPage } from '@/pages/security/SecurityPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { ChannelsPage } from '@/pages/channels/ChannelsPage';
import { VodPage } from '@/pages/vod/VodPage';
import { SeriesPage } from '@/pages/series/SeriesPage';
import { useAuthStore } from '@/store/auth.store';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken;
    if (token) throw redirect({ to: '/dashboard' });
  },
  component: LoginPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/dashboard' }); },
  component: () => null,
});

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw redirect({ to: '/login' });
  },
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const streamsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/streams',
  component: StreamsPage,
});

const usersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/users',
  component: UsersPage,
});

const resellersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/resellers',
  component: ResellersPage,
});

const liveConnectionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/live-connections',
  component: LiveConnectionsPage,
});

const serversRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/servers',
  component: ServersPage,
});

const channelsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/channels',
  component: ChannelsPage,
});

const vodRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/vod',
  component: VodPage,
});

const seriesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/series',
  component: SeriesPage,
});

const categoriesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/categories',
  component: CategoriesPage,
});

const bouquetsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bouquets',
  component: BouquetsPage,
});

const epgRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/epg',
  component: EPGSourcesPage,
});

const epgMassAssignRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/epg/mass-assign',
  component: EPGMassAssignPage,
});

const packagesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/packages',
  component: PackagesPage,
});

const migrationRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/migration',
  component: MigrationPage,
});

const securityRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/security',
  component: SecurityPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  layoutRoute.addChildren([
    dashboardRoute,
    streamsRoute,
    usersRoute,
    resellersRoute,
    liveConnectionsRoute,
    serversRoute,
    channelsRoute,
    vodRoute,
    seriesRoute,
    categoriesRoute,
    bouquetsRoute,
    epgRoute,
    epgMassAssignRoute,
    packagesRoute,
    migrationRoute,
    securityRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
