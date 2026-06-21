import axios, { type InternalAxiosRequestConfig } from 'axios';

// Lazy import to avoid circular dependency — auth.store imports nothing from here
const getAuthState = () => import('@/store/auth.store').then((m) => m.useAuthStore.getState());

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const { accessToken } = (await getAuthState());
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        if (!refreshing) {
          refreshing = (await getAuthState()).refresh().finally(() => {
            refreshing = null;
          });
        }
        await refreshing;
        const { accessToken } = await getAuthState();
        if (accessToken) {
          original.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(original);
      } catch {
        const { logout } = await getAuthState();
        logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(err as Error);
  },
);

export default api;
