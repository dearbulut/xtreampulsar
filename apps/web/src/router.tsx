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
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { useAuthStore } from '@/store/auth.store';

// Root route — just an outlet
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Public: login
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken;
    if (token) throw redirect({ to: '/dashboard' });
  },
  component: LoginPage,
});

// Index redirect
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
  component: () => null,
});

// Protected layout route
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_layout',
  beforeLoad: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw redirect({ to: '/login' });
  },
  component: AppLayout,
});

// Protected children
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
  component: () => <ComingSoonPage title="Sunucular" description="Sunucu yönetimi yakında geliyor." />,
});

const channelsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/channels',
  component: () => <ComingSoonPage title="Kanallar" />,
});

const vodRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/vod',
  component: () => <ComingSoonPage title="VOD" />,
});

const seriesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/series',
  component: () => <ComingSoonPage title="Diziler" />,
});

const categoriesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/categories',
  component: () => <ComingSoonPage title="Kategoriler" />,
});

const bouquetsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bouquets',
  component: () => <ComingSoonPage title="Bouquet'lar" />,
});

const epgRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/epg',
  component: () => <ComingSoonPage title="EPG Kaynakları" />,
});

const packagesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/packages',
  component: () => <ComingSoonPage title="Paketler" />,
});

const migrationRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/migration',
  component: () => <ComingSoonPage title="Migration" />,
});

const securityRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/security',
  component: () => <ComingSoonPage title="Güvenlik" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings',
  component: () => <ComingSoonPage title="Ayarlar" />,
});

// Route tree
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
