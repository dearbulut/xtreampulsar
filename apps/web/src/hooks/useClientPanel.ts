import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

// Axios instance with client (end-user) JWT — resellerApi örüntüsünün aynısı.
const clientApi = axios.create({ baseURL: '/api/v1' });

clientApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().clientToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let clientRefreshing = false;
let clientRefreshQueue: Array<(token: string) => void> = [];

clientApi.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    const axiosErr = err as { config?: { _retry?: boolean; headers?: Record<string, string> }; response?: { status?: number } };
    const status = axiosErr?.response?.status;

    if (status === 401 && !axiosErr.config?._retry) {
      const store = useAuthStore.getState();
      if (store.clientRefreshToken) {
        if (clientRefreshing) {
          return new Promise((resolve) => {
            clientRefreshQueue.push((token: string) => {
              if (axiosErr.config) axiosErr.config.headers = { ...axiosErr.config.headers, Authorization: `Bearer ${token}` };
              resolve(clientApi(axiosErr.config ?? {}));
            });
          });
        }
        clientRefreshing = true;
        if (axiosErr.config) axiosErr.config._retry = true;
        try {
          await store.clientRefresh();
          const newToken = useAuthStore.getState().clientToken ?? '';
          clientRefreshQueue.forEach((cb) => cb(newToken));
          clientRefreshQueue = [];
          if (axiosErr.config) axiosErr.config.headers = { ...axiosErr.config.headers, Authorization: `Bearer ${newToken}` };
          return clientApi(axiosErr.config ?? {});
        } catch {
          clientRefreshQueue = [];
          store.clientLogout();
          window.location.href = '/client/login';
        } finally {
          clientRefreshing = false;
        }
      } else {
        store.clientLogout();
        window.location.href = '/client/login';
      }
    } else if (status === 503) {
      toast.error('Sunucu geçici olarak kullanılamıyor, lütfen bekleyin.');
    } else if (status === 429) {
      toast.error('Çok fazla istek gönderildi, lütfen bekleyin.');
    }
    return Promise.reject(err as Error);
  },
);

export { clientApi };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientMe {
  id: string;
  username: string;
  status: string;
  expiresAt: string;
  maxConnections: number;
  isTrial: boolean;
  createdAt: string;
  activeConnections: number;
  serverUrl: string;
  serverPort: number;
}

export interface ClientConnection {
  id: string;
  ip: string;
  startedAt: string;
  durationSeconds: number;
  stream: { id: string; name: string } | null;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useClientMe() {
  const token = useAuthStore((s) => s.clientToken);
  return useQuery({
    queryKey: ['client-panel', 'me'],
    enabled: !!token,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await clientApi.get<{ success: boolean; data: ClientMe }>('/client/me');
      return res.data.data;
    },
  });
}

export function useClientConnections() {
  const token = useAuthStore((s) => s.clientToken);
  return useQuery({
    queryKey: ['client-panel', 'connections'],
    enabled: !!token,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await clientApi.get<{ success: boolean; data: ClientConnection[] }>('/client/me/connections');
      return res.data.data;
    },
  });
}

export function useClientChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      clientApi.patch('/auth/change-password', data),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Şifre değiştirilemedi');
    },
  });
}


export interface ClientRequestItem {
  id: string;
  type: 'REPORT' | 'NEW_CHANNEL';
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  title: string;
  message?: string | null;
  adminNote?: string | null;
  createdAt: string;
  stream?: { id: string; name: string } | null;
  messages?: Array<{ id: string; sender: string; body: string; createdAt: string }>;
}

export function useMyClientRequests() {
  const token = useAuthStore((s) => s.clientToken);
  return useQuery({
    queryKey: ['client-panel', 'requests'],
    enabled: !!token,
    queryFn: async () => {
      const res = await clientApi.get<{ success: boolean; data: ClientRequestItem[] }>('/client/me/requests');
      return res.data.data;
    },
  });
}

export function useAddClientRequestMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      clientApi.post(`/client/me/requests/${id}/messages`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-panel', 'requests'] }),
  });
}


export function useCreateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: 'REPORT' | 'NEW_CHANNEL'; streamId?: string; title: string; message?: string }) =>
      clientApi.post('/client/requests', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-panel', 'requests'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Gönderilemedi');
    },
  });
}
