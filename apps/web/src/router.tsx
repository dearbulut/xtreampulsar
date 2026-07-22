import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { getPanelMode } from '@/lib/panelMode';
import { LoginPage } from '@/pages/auth/LoginPage';
import { TwoFactorSetupPage } from '@/pages/auth/TwoFactorSetupPage';
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
import { EPGMappingsPage } from '@/pages/epg/EPGMappingsPage';
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
import { ResellerProfilePage } from '@/pages/reseller/ResellerProfilePage';
import { ResellerSubResellersPage } from '@/pages/reseller/ResellerSubResellersPage';
import { RevenuePage } from '@/pages/analytics/RevenuePage';
import { EpgGuidePage } from '@/pages/epg/EpgGuidePage';
import { UserReportPage } from '@/pages/users/UserReportPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { WebhooksPage } from '@/pages/webhooks/WebhooksPage';
import { MagDevicesPage } from '@/pages/mag/MagDevicesPage';
import { ResellerLivePage } from '@/pages/reseller/ResellerLivePage';
import { ResellerActivityPage } from '@/pages/reseller/ResellerActivityPage';
import { ResellerNotificationsPage } from '@/pages/reseller/ResellerNotificationsPage';
import { ResellerApiPage } from '@/pages/reseller/ResellerApiPage';
import { SupportPage } from '@/pages/support/SupportPage';
import { ClientRequestsPage } from '@/pages/client-requests/ClientRequestsPage';
import { ActivationCodesPage } from '@/pages/activation/ActivationCodesPage';
import { MostWatchedPage } from '@/pages/analytics/MostWatchedPage';
import { StoreOrdersPage } from '@/pages/store/StoreOrdersPage';
import { StorefrontPage } from '@/pages/store/StorefrontPage';
import { SystemHealthPage } from '@/pages/system/SystemHealthPage';
import { CommissionsPage } from '@/pages/commissions/CommissionsPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { SubtitlesPage } from '@/pages/subtitles/SubtitlesPage';
import { DownloadsPage } from '@/pages/downloads/DownloadsPage';
import { M3uSyncPage } from '@/pages/m3u-sync/M3uSyncPage';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ClientLoginPage } from '@/pages/client/ClientLoginPage';
import { ClientDashboardPage } from '@/pages/client/ClientDashboardPage';
import { useAuthStore } from '@/store/auth.store';
import { NotFoundPage } from '@/pages/misc/NotFoundPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    const mode = getPanelMode();
    if (mode === 'reseller') throw redirect({ to: '/reseller/login' });
    if (mode === 'client') throw redirect({ to: '/client/login' });
    const token = useAuthStore.getState().accessToken;
    if (token) throw redirect({ to: '/dashboard' });
  },
  component: LoginPage,
});

const setup2FARoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup-2fa',
  component: TwoFactorSetupPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    const mode = getPanelMode();
    if (mode === 'reseller') throw redirect({ to: '/reseller/login' });
    if (mode === 'client') throw redirect({ to: '/client/login' });
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  beforeLoad: () => {
    const mode = getPanelMode();
    if (mode === 'reseller') throw redirect({ to: '/reseller/login' });
    if (mode === 'client') throw redirect({ to: '/client/login' });
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

const epgMappingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/epg/mappings',
  component: EPGMappingsPage,
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

const webhooksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/webhooks',
  component: WebhooksPage,
});

const magDevicesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/mag-devices',
  component: MagDevicesPage,
});

const supportRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/support',
  component: SupportPage,
});

const clientRequestsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/client-requests',
  component: ClientRequestsPage,
});

const activationCodesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/activation-codes',
  component: ActivationCodesPage,
});

const mostWatchedRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/analytics/most-watched',
  component: MostWatchedPage,
});

const storeOrdersRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/store-orders',
  component: StoreOrdersPage,
});

const systemHealthRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/system-health',
  component: SystemHealthPage,
});

const commissionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/commissions',
  component: CommissionsPage,
});

const invoicesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/invoices',
  component: InvoicesPage,
});

const subtitlesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/subtitles',
  component: SubtitlesPage,
});

const downloadsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/downloads',
  component: DownloadsPage,
});

// Public self-servis magaza (auth yok, panel-moddan bagimsiz)
const storefrontRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/store',
  component: StorefrontPage,
});

const m3uSyncRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/m3u-sources',
  component: M3uSyncPage,
});

// ─── Reseller routes ─────────────────────────────────────────────────────────

const resellerLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reseller/login',
  beforeLoad: () => {
    if (getPanelMode() === 'client') throw redirect({ to: '/client/login' });
    const token = useAuthStore.getState().resellerToken;
    if (token) throw redirect({ to: '/reseller/dashboard' });
  },
  component: ResellerLoginPage,
});

const resellerLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_reseller',
  beforeLoad: () => {
    if (getPanelMode() === 'client') throw redirect({ to: '/client/login' });
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

const resellerProfileRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/profile',
  component: ResellerProfilePage,
});

const resellerSubResellersRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/sub-resellers',
  component: ResellerSubResellersPage,
});

const resellerLiveRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/live',
  component: ResellerLivePage,
});

const resellerActivityRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/activity',
  component: ResellerActivityPage,
});

const resellerNotificationsRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/notifications',
  component: ResellerNotificationsPage,
});

const resellerApiRoute = createRoute({
  getParentRoute: () => resellerLayoutRoute,
  path: '/reseller/api',
  component: ResellerApiPage,
});

// ─── Client (end-user) routes ────────────────────────────────────────────────

const clientLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/client/login',
  beforeLoad: () => {
    if (getPanelMode() === 'reseller') throw redirect({ to: '/reseller/login' });
    const token = useAuthStore.getState().clientToken;
    if (token) throw redirect({ to: '/client/dashboard' });
  },
  component: ClientLoginPage,
});

const clientLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_client',
  beforeLoad: () => {
    if (getPanelMode() === 'reseller') throw redirect({ to: '/reseller/login' });
    const token = useAuthStore.getState().clientToken;
    if (!token) throw redirect({ to: '/client/login' });
  },
  component: ClientLayout,
});

const clientDashboardRoute = createRoute({
  getParentRoute: () => clientLayoutRoute,
  path: '/client/dashboard',
  component: ClientDashboardPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  storefrontRoute,
  setup2FARoute,
  resellerLoginRoute,
  resellerLayoutRoute.addChildren([
    resellerDashboardRoute,
    resellerUsersRoute,
    resellerCreateUserRoute,
    resellerSubResellersRoute,
    resellerCreditsRoute,
    resellerProfileRoute,
    resellerLiveRoute,
    resellerActivityRoute,
    resellerNotificationsRoute,
    resellerApiRoute,
  ]),
  clientLoginRoute,
  clientLayoutRoute.addChildren([
    clientDashboardRoute,
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
    epgMappingsRoute,
    epgGuideRoute,
    packagesRoute,
    migrationRoute,
    securityRoute,
    settingsRoute,
    advancedToolsRoute,
    revenueRoute,
    userReportRoute,
    profileRoute,
    webhooksRoute,
    magDevicesRoute,
    supportRoute,
    clientRequestsRoute,
    activationCodesRoute,
    mostWatchedRoute,
    storeOrdersRoute,
    systemHealthRoute,
    commissionsRoute,
    invoicesRoute,
    subtitlesRoute,
    downloadsRoute,
    m3uSyncRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultNotFoundComponent: NotFoundPage });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
