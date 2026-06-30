import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import type { Package, PaginatedResponse } from '@/types';

// Axios instance with reseller JWT
const resellerApi = axios.create({ baseURL: '/api/v1' });

resellerApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().resellerToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

resellerApi.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401) {
      useAuthStore.getState().resellerLogout();
      window.location.href = '/reseller/login';
    } else if (status === 503) {
      toast.error('Sunucu geçici olarak kullanılamıyor, lütfen bekleyin.');
    } else if (status === 429) {
      toast.error('Çok fazla istek gönderildi, lütfen bekleyin.');
    }
    return Promise.reject(err as Error);
  },
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResellerDashboard {
  credits: number;
  totalUsers: number;
  activeUsers: number;
  newThisWeek: number;
  expiringSoonCount: number;
  onlineConnections: number;
}

export interface ResellerStats {
  totalUsers: number;
  activeUsers: number;
  expiredUsers: number;
  onlineConnections: number;
}

export interface ResellerInfo {
  id: string;
  username: string;
  email: string | null;
  credits: number;
  tier: string;
  isActive: boolean;
  createdAt: string;
}

export interface ResellerUserRow {
  id: string;
  username: string;
  status: string;
  expiresAt: string;
  maxConnections: number;
  createdAt: string;
  _count?: { connections: number };
}

export interface QuickCreateResult {
  user: { id: string; username: string; password: string; expiresAt: string };
  m3uUrl: string;
  playerApiUrl: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useResellerMe() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'me'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerInfo }>('/resellers/me');
      return res.data.data;
    },
  });
}

export function useResellerDashboard() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'dashboard'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerDashboard }>('/resellers/me/dashboard');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useResellerStats() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'stats'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerStats }>('/resellers/me/stats');
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export function useResellerExpiring() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'expiring'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerUserRow[] }>('/resellers/me/expiring');
      return res.data.data;
    },
  });
}

export function useResellerUsers(
  page = 1,
  limit = 20,
  search?: string,
  status?: string,
  sortBy?: string,
  sortDir?: string,
  expiryFilter?: string,
) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'users', page, limit, search, status, sortBy, sortDir, expiryFilter],
    enabled: !!token,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortDir) params.set('sortDir', sortDir);
      if (expiryFilter) params.set('expiryFilter', expiryFilter);
      const res = await resellerApi.get<{ success: boolean; data: PaginatedResponse<ResellerUserRow> }>(
        `/resellers/me/users?${params.toString()}`,
      );
      return res.data.data;
    },
  });
}

export function useResellerPackages() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'packages'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: Package[] }>('/resellers/me/packages');
      return res.data.data;
    },
  });
}

export function useResellerCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      username: string;
      password: string;
      maxConnections: number;
      expiresAt: string;
      packageId?: string;
    }) => resellerApi.post('/users', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel'] });
      toast.success('Kullanıcı oluşturuldu');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Kullanıcı oluşturulamadı');
    },
  });
}

export function useResellerQuickCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      username?: string;
      password?: string;
      durationDays?: number;
      durationHours?: number;
      maxConnections: number;
      notes?: string;
    }) => {
      const res = await resellerApi.post<{ success: boolean; data: QuickCreateResult }>(
        '/resellers/me/users/quick-create',
        data,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Kullanıcı oluşturulamadı');
    },
  });
}

export function useResellerQuickCreateWithPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username?: string; password?: string; packageId: string; notes?: string }) => {
      const res = await resellerApi.post<{ success: boolean; data: QuickCreateResult }>(
        '/resellers/me/users/quick-create-package',
        data,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Kullanıcı oluşturulamadı');
    },
  });
}

export function useResellerUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email?: string }) =>
      resellerApi.put('/resellers/me/profile', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'me'] });
      toast.success('Profil güncellendi');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Güncelleme başarısız');
    },
  });
}

export function useResellerChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      resellerApi.put('/resellers/me/password', data),
    onSuccess: () => toast.success('Şifre değiştirildi'),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Şifre değiştirilemedi');
    },
  });
}

export function useResellerBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { action: 'extend' | 'suspend' | 'activate'; userIds: string[]; days?: number }) =>
      resellerApi.post<{ success: boolean; data: { affected: number } }>('/resellers/me/users/bulk', data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      const label =
        vars.action === 'extend' ? 'Süre uzatıldı' :
        vars.action === 'suspend' ? 'Askıya alındı' : 'Aktifleştirildi';
      toast.success(label);
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useResellerUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; maxConnections?: number; expiresAt?: string; notes?: string; status?: string }) =>
      resellerApi.put(`/resellers/me/users/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      toast.success('Güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useResellerDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resellerApi.delete(`/resellers/me/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      toast.success('Kullanıcı silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useResellerBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resellerApi.post(`/users/${id}/ban`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      toast.success('Kullanıcı banlandı');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useResellerExtendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      resellerApi.post(`/users/${id}/extend`, { days }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      toast.success('Süre uzatıldı');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useResellerKickUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resellerApi.post(`/users/${id}/kick`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      toast.success('Kullanıcı bağlantısı kesildi');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useResellerResetPassword() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await resellerApi.post<{ success: boolean; data: { password: string } }>(
        `/resellers/me/users/${userId}/reset-password`,
      );
      return res.data.data;
    },
    onError: () => toast.error('Şifre sıfırlanamadı'),
  });
}

export function useResellerUserPlaylists(userId: string | null) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'user-playlists', userId],
    enabled: !!userId && !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{
        success: boolean;
        data: Array<{
          id: string; name: string; type: string; isActive: boolean;
          accessCount: number; lastAccessed: string | null;
          expiresAt: string | null; token: string;
        }>;
      }>(`/resellers/me/users/${userId}/playlists`);
      return res.data.data;
    },
  });
}

export interface CreditLogEntry {
  id: string;
  amount: number;
  type: 'ADD' | 'DEDUCT';
  reason: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface CreditHistoryResponse {
  items: CreditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { added: number; spent: number };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ResellerNotification {
  id: string;
  resellerId: string;
  type: 'LOW_CREDIT' | 'USER_EXPIRING' | string;
  title: string;
  message: string;
  isRead: boolean;
  metadata: unknown;
  createdAt: string;
}

export function useResellerUnreadCount() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'notifications', 'unread-count'],
    enabled: !!token,
    refetchInterval: 30_000,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: { count: number } }>(
        '/resellers/me/notifications/unread-count',
      );
      return res.data.data.count;
    },
  });
}

export function useResellerNotifications(unreadOnly = false) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'notifications', unreadOnly],
    enabled: !!token,
    queryFn: async () => {
      const params = unreadOnly ? '?unreadOnly=true' : '';
      const res = await resellerApi.get<{ success: boolean; data: ResellerNotification[] }>(
        `/resellers/me/notifications${params}`,
      );
      return res.data.data;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notifId: string) =>
      resellerApi.put(`/resellers/me/notifications/${notifId}/read`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reseller-panel', 'notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resellerApi.put('/resellers/me/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'notifications'] });
      toast.success('Tüm bildirimler okundu işaretlendi');
    },
  });
}

export function useResellerCreditHistory(page = 1, limit = 30, startDate?: string) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'credits', page, limit, startDate],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (startDate) params.set('startDate', startDate);
      const res = await resellerApi.get<{ success: boolean; data: CreditHistoryResponse }>(
        `/resellers/me/credits?${params.toString()}`,
      );
      return res.data.data;
    },
  });
}
