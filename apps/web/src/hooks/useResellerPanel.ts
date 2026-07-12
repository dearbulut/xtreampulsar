import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import type { Package, PaginatedResponse } from '@/types';
import type { CreditPricingConfig } from './useSettings';
import { DEFAULT_CREDIT_PRICING } from './useSettings';

// Axios instance with reseller JWT
const resellerApi = axios.create({ baseURL: '/api/v1' });

resellerApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().resellerToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let resellerRefreshing = false;
let resellerRefreshQueue: Array<(token: string) => void> = [];

resellerApi.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    const axiosErr = err as { config?: { _retry?: boolean; headers?: Record<string, string> }; response?: { status?: number } };
    const status = axiosErr?.response?.status;

    if (status === 401 && !axiosErr.config?._retry) {
      const store = useAuthStore.getState();
      if (store.resellerRefreshToken) {
        if (resellerRefreshing) {
          return new Promise((resolve) => {
            resellerRefreshQueue.push((token: string) => {
              if (axiosErr.config) axiosErr.config.headers = { ...axiosErr.config.headers, Authorization: `Bearer ${token}` };
              resolve(resellerApi(axiosErr.config ?? {}));
            });
          });
        }
        resellerRefreshing = true;
        if (axiosErr.config) axiosErr.config._retry = true;
        try {
          await store.resellerRefresh();
          const newToken = useAuthStore.getState().resellerToken ?? '';
          resellerRefreshQueue.forEach((cb) => cb(newToken));
          resellerRefreshQueue = [];
          if (axiosErr.config) axiosErr.config.headers = { ...axiosErr.config.headers, Authorization: `Bearer ${newToken}` };
          return resellerApi(axiosErr.config ?? {});
        } catch {
          resellerRefreshQueue = [];
          store.resellerLogout();
          window.location.href = '/reseller/login';
        } finally {
          resellerRefreshing = false;
        }
      } else {
        store.resellerLogout();
        window.location.href = '/reseller/login';
      }
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
  maxUsers: number;
  totalUsers: number;
  activeUsers: number;
  newThisWeek: number;
  expiringSoonCount: number;
  onlineConnections: number;
  // Extended
  connectionsToday: number;
  newUsersThisMonth: number;
  expiringSoon: number;
  avgWatchMinutes: number;
  dailyConnections: { date: string; count: number }[];
  userStatusDistribution: { active: number; expired: number; banned: number };
}

export interface LiveConnection {
  id: string;
  ip: string;
  startedAt: string;
  durationSeconds: number;
  user: { id: string; username: string };
  stream: { id: string; name: string };
}

export interface ActivityItem {
  id: string;
  action: string;
  ip: string | null;
  country: string | null;
  duration: number | null;
  createdAt: string;
  streamId: string | null;
  user: { id: string; username: string } | null;
}

export interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { totalSessions: number; totalWatchMinutes: number; mostActiveUser: string };
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
  brandName?: string | null;
  logoUrl?: string | null;
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
    mutationFn: ({ id, ...data }: { id: string; maxConnections?: number; expiresAt?: string; notes?: string; status?: string; bouquetIds?: string[] }) =>
      resellerApi.put(`/resellers/me/users/${id}`, data),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'users'] });
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'user-bouquets', vars.id] });
      toast.success('Güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

// Kullanıcının atanmış bouquet'leri (getMyUserDetail bouquets alanı).
export function useResellerUserBouquets(userId: string | null) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'user-bouquets', userId],
    enabled: !!userId && !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: { bouquets?: { id: string; name: string }[] } }>(
        `/resellers/me/users/${userId!}`,
      );
      return res.data.data.bouquets ?? [];
    },
  });
}

// Tüm bouquet seçenekleri (reseller düzenleme MultiSelect'i için).
export function useResellerBouquets() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'bouquets'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: { id: string; name: string }[] }>('/bouquets');
      const raw = res.data?.data ?? [];
      return Array.isArray(raw) ? raw.map((b) => ({ id: b.id, name: b.name })) : [];
    },
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
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const res = await resellerApi.post<{ success: boolean; data: unknown }>(
        `/resellers/me/users/${id}/extend`,
        { days },
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Uzatma başarısız');
    },
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

// ─── Sub-resellers ────────────────────────────────────────────────────────────

export interface SubReseller {
  id: string;
  username: string;
  email: string | null;
  credits: number;
  tier: string;
  isActive: boolean;
  createdAt: string;
  _count?: { users: number };
}

export function useResellerSubResellers() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'sub-resellers'],
    enabled: !!token,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: SubReseller[] }>('/resellers/me/sub-resellers');
      return res.data.data;
    },
  });
}

export function useResellerCreateSubReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string; email?: string; credits?: number }) => {
      const res = await resellerApi.post<{ success: boolean; data: SubReseller }>(
        '/resellers/me/sub-resellers',
        data,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'sub-resellers'] });
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'me'] });
      toast.success('Alt bayi oluşturuldu');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Alt bayi oluşturulamadı');
    },
  });
}

export function useResellerTransferCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ subId, amount }: { subId: string; amount: number }) => {
      const res = await resellerApi.post<{ success: boolean; data: { transferred: number; fromBalance: number; toBalance: number } }>(
        `/resellers/me/sub-resellers/${subId}/transfer-credits`,
        { amount },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'sub-resellers'] });
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'me'] });
      toast.success(`${data.transferred} kredi transfer edildi`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Transfer başarısız');
    },
  });
}

// ─── Branding ─────────────────────────────────────────────────────────────────

export function useUpdateResellerBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { brandName?: string }) => {
      const res = await resellerApi.put<{ success: boolean; data: { brandName: string | null; logoUrl: string | null } }>(
        '/resellers/me/branding',
        data,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'me'] });
      toast.success('Marka adı kaydedildi');
    },
    onError: () => toast.error('Kaydedilemedi'),
  });
}

export function useCreditPricing() {
  return useQuery({
    queryKey: ['credit-pricing'],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      // Public endpoint — plain axios, no auth required
      const res = await axios.get<{ success: boolean; data: CreditPricingConfig }>('/api/v1/settings/credit-pricing');
      const payload = res.data?.data ?? res.data;
      if (!payload || typeof payload !== 'object' || !('durations' in payload)) {
        return DEFAULT_CREDIT_PRICING;
      }
      return payload as CreditPricingConfig;
    },
    // initialData so pricing is ALWAYS defined (never undefined after error)
    initialData: DEFAULT_CREDIT_PRICING,
    initialDataUpdatedAt: 0, // force a refetch on mount despite initialData
  });
}

export function computeCustomCreditCost(days: number, pricing: CreditPricingConfig, tierMultiplier = 1): number {
  const exact = pricing.durations.find((d) => d.days === days);
  if (exact) return Math.max(1, Math.ceil(exact.credits * tierMultiplier));
  if (pricing.customPricing?.enabled) {
    return Math.max(1, Math.ceil(days * (pricing.customPricing.creditsPerDay ?? 0.1) * tierMultiplier));
  }
  return Math.max(1, Math.ceil((days / 30) * tierMultiplier));
}

export function useResellerLiveConnections() {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'live-connections'],
    enabled: !!token,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: LiveConnection[] }>(
        '/resellers/me/live-connections',
      );
      return res.data.data;
    },
  });
}

export function useKickLiveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      resellerApi.post(`/resellers/me/kick/${connectionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'live-connections'] });
      toast.success('Bağlantı kesildi');
    },
    onError: () => toast.error('Bağlantı kesilemedi'),
  });
}

export function useResellerActivity(opts: {
  startDate?: string;
  endDate?: string;
  userId?: string;
  page: number;
  limit?: number;
}) {
  const token = useAuthStore((s) => s.resellerToken);
  return useQuery({
    queryKey: ['reseller-panel', 'activity', opts],
    enabled: !!token,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(opts.page), limit: String(opts.limit ?? 50) });
      if (opts.startDate) params.set('startDate', opts.startDate);
      if (opts.endDate) params.set('endDate', opts.endDate);
      if (opts.userId) params.set('userId', opts.userId);
      const res = await resellerApi.get<{ success: boolean; data: ActivityResponse }>(
        `/resellers/me/activity?${params.toString()}`,
      );
      return res.data.data;
    },
  });
}

export function useUploadBrandingLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await resellerApi.post<{ success: boolean; data: { logoUrl: string } }>(
        '/resellers/me/branding/logo',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reseller-panel', 'me'] });
      toast.success('Logo yüklendi');
    },
    onError: () => toast.error('Logo yüklenemedi'),
  });
}
