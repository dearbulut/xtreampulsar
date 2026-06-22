import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { AuthUser } from '@/types';

// Raw axios for auth calls — no circular dep with api.ts
const authClient = axios.create({ baseURL: '/api/v1' });

export interface ResellerUser {
  id: string;
  username: string;
  credits: number;
  tier: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  resellerToken: string | null;
  resellerUser: ResellerUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setTokens: (access: string, refresh: string, user: AuthUser) => void;
  resellerLogin: (username: string, password: string) => Promise<void>;
  resellerLogout: () => void;
}

type PersistedState = Pick<AuthState, 'accessToken' | 'refreshToken' | 'user' | 'resellerToken' | 'resellerUser'>;

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedState>(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      resellerToken: null,
      resellerUser: null,

      setTokens(access: string, refresh: string, user: AuthUser) {
        set({ accessToken: access, refreshToken: refresh, user });
      },

      async login(username: string, password: string) {
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string; user: AuthUser };
        }>('/auth/login', { username, password });
        const { accessToken, refreshToken, user } = res.data.data;
        set({ accessToken, refreshToken, user });
      },

      logout() {
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

      async resellerLogin(username: string, password: string) {
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; reseller: ResellerUser };
        }>('/auth/reseller/login', { username, password });
        const { accessToken, reseller } = res.data.data;
        set({ resellerToken: accessToken, resellerUser: reseller });
      },

      resellerLogout() {
        set({ resellerToken: null, resellerUser: null });
      },
    }),
    {
      name: 'xp-auth',
      partialize: (state): PersistedState => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        resellerToken: state.resellerToken,
        resellerUser: state.resellerUser,
      }),
    },
  ),
);
