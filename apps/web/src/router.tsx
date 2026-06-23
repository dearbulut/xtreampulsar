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
import { AdvancedToolsPage } from '@/pages/tools/AdvancedToolsPage';
import { ChannelsPage } from '@/pages/channels/ChannelsPage';
import { VodPage } from '@/pages/vod/VodPage';
import { SeriesPage } from '@/pages/series/SeriesPage';
import { ResellerLayout } from '@/components/layout/ResellerLayout';
import { ResellerLoginPage } from '@/pages/reseller/ResellerLoginPage';
import { ResellerDashboardPage } from '@/pages/reseller/ResellerDashboardPage';
import { ResellerUsersPage } from '@/pages/reseller/ResellerUsersPage';
import { ResellerCreateUserPage } from '@/pages/reseller/ResellerCreateUserPage';
import { ResellerCreditsPage } from '@/pages/reseller/ResellerCreditsPage';
import { RevenuePage } from '@/pages/analytics/RevenuePage';
import { EpgGuidePage } from '@/pages/epg/EpgGuidePage';
import { UserReportPage } from '@/pages/users/UserReportPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
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

const advancedToolsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/tools/advanced',
  component: AdvancedToolsPage,
});

const revenueRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/analytics/revenue',
  component: RevenuePage,
});

const epgGuideRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/epg/guide',
  component: EpgGuidePage,
});

const userReportRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/users/report',
  component: UserReportPage,
});

const profileRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/profile',
  component: ProfilePage,
});

// ─── Reseller routes ─────────────────────────────────────────────────────────

const resellerLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reseller/login',
  beforeLoad: () => {
    const token = useAuthStore.getState().resellerToken;
    if (token) throw redirect({ to: '/reseller/dashboard' });
  },
  component: ResellerLoginPage,
});

const resellerLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_reseller',
  beforeLoad: () => {
    const token = useAuthStore.getState().resellerToken;
    if (!token) throw redirect({ to: '/reseller/login' });
  },
  component: ResellerLayout,
});

const resellerDashboardRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/dashboard',
  component: ResellerDashboardPage,
});

const resellerUsersRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/users',
  component: ResellerUsersPage,
});

const resellerCreateUserRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/users/create',
  component: ResellerCreateUserPage,
});

const resellerCreditsRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/credits',
  component: ResellerCreditsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  resellerLoginRoute,
  resellerLayoutRoute.addChildren([
    resellerDashboardRoute,
    resellerUsersRoute,
    resellerCreateUserRoute,
    resellerCreditsRoute,
  ]),
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
    epgGuideRoute,
    packagesRoute,
    migrationRoute,
    securityRoute,
    settingsRoute,
    advancedToolsRoute,
    revenueRoute,
    userReportRoute,
    profileRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
