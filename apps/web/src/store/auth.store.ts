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

export interface ClientUser {
  id: string;
  username: string;
  status: string;
  expiresAt: string;
  maxConnections: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  resellerToken: string | null;
  resellerRefreshToken: string | null;
  resellerUser: ResellerUser | null;
  clientToken: string | null;
  clientRefreshToken: string | null;
  clientUser: ClientUser | null;
  clientPassword: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setTokens: (access: string, refresh: string, user: AuthUser) => void;
  resellerLogin: (username: string, password: string) => Promise<void>;
  resellerRefresh: () => Promise<void>;
  resellerLogout: () => void;
  clientLogin: (username: string, password: string) => Promise<void>;
  clientRefresh: () => Promise<void>;
  clientLogout: () => void;
}

type PersistedState = Pick<
  AuthState,
  | 'accessToken'
  | 'refreshToken'
  | 'user'
  | 'resellerToken'
  | 'resellerRefreshToken'
  | 'resellerUser'
  | 'clientToken'
  | 'clientRefreshToken'
  | 'clientUser'
>;

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedState>(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      resellerToken: null,
      resellerRefreshToken: null,
      resellerUser: null,
      clientToken: null,
      clientRefreshToken: null,
      clientUser: null,
      clientPassword: null,

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
          data: { accessToken: string; refreshToken: string; reseller: ResellerUser };
        }>('/auth/reseller/login', { username, password });
        const { accessToken, refreshToken, reseller } = res.data.data;
        set({ resellerToken: accessToken, resellerRefreshToken: refreshToken, resellerUser: reseller });
      },

      async resellerRefresh() {
        const token = get().resellerRefreshToken;
        if (!token) throw new Error('No reseller refresh token');
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>('/auth/reseller/refresh', { refreshToken: token });
        const { accessToken, refreshToken } = res.data.data;
        set({ resellerToken: accessToken, resellerRefreshToken: refreshToken });
      },

      resellerLogout() {
        const token = get().resellerRefreshToken;
        if (token) {
          void authClient
            .post('/auth/reseller/logout', { refreshToken: token })
            .catch(() => {});
        }
        set({ resellerToken: null, resellerRefreshToken: null, resellerUser: null });
      },

      async clientLogin(username: string, password: string) {
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string; user: ClientUser };
        }>('/auth/client/login', { username, password });
        const { accessToken, refreshToken, user } = res.data.data;
        set({
          clientToken: accessToken,
          clientRefreshToken: refreshToken,
          clientUser: user,
          clientPassword: password,
        });
      },

      async clientRefresh() {
        const token = get().clientRefreshToken;
        if (!token) throw new Error('No client refresh token');
        const res = await authClient.post<{
          success: boolean;
          data: { accessToken: string };
        }>('/auth/client/refresh', { refreshToken: token });
        const { accessToken } = res.data.data;
        set({ clientToken: accessToken });
      },

      clientLogout() {
        set({
          clientToken: null,
          clientRefreshToken: null,
          clientUser: null,
          clientPassword: null,
        });
      },
    }),
    {
      name: 'xp-auth',
      partialize: (state): PersistedState => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        resellerToken: state.resellerToken,
        resellerRefreshToken: state.resellerRefreshToken,
        resellerUser: state.resellerUser,
        clientToken: state.clientToken,
        clientRefreshToken: state.clientRefreshToken,
        clientUser: state.clientUser,
        // clientPassword bilinçli olarak persist EDİLMEZ — yalnız bellekte tutulur.
      }),
    },
  ),
);
