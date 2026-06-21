import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { AuthUser } from '@/types';

// Raw axios for auth calls — no circular dep with api.ts
const authClient = axios.create({ baseURL: '/api/v1' });

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setTokens: (access: string, refresh: string, user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setTokens(access, refresh, user) {
        set({ accessToken: access, refreshToken: refresh, user });
      },

      async login(username, password) {
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string; user: AuthUser };
        }>('/auth/login', { username, password });
        const { accessToken, refreshToken, user } = res.data.data;
        set({ accessToken, refreshToken, user });
      },

      logout() {
        // fire-and-forget logout call to invalidate refresh token
        const token = get().refreshToken;
        if (token) {
          void authClient
            .post('/auth/logout', { refreshToken: token })
            .catch(() => {});
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      async refresh() {
        const token = get().refreshToken;
        if (!token) throw new Error('No refresh token');
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>('/auth/refresh', { refreshToken: token });
        const { accessToken, refreshToken } = res.data.data;
        set({ accessToken, refreshToken });
      },
    }),
    {
      name: 'xp-auth',
      partializer: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    } as Parameters<typeof persist>[1],
  ),
);
