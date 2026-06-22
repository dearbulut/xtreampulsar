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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResellerStats {
  totalUsers: number;
  activeUsers: number;
  expiredUsers: number;
  onlineConnections: number;
}

export interface ResellerInfo {
  id: string;
  username: string;
  email: string;
  credits: number;
  tier: string;
  isActive: boolean;
}

export interface ResellerUserRow {
  id: string;
  username: string;
  status: string;
  expiresAt: string;
  maxConnections: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useResellerMe() {
  return useQuery({
    queryKey: ['reseller-panel', 'me'],
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerInfo }>('/resellers/me');
      return res.data.data;
    },
  });
}

export function useResellerStats() {
  return useQuery({
    queryKey: ['reseller-panel', 'stats'],
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerStats }>('/resellers/me/stats');
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export function useResellerExpiring() {
  return useQuery({
    queryKey: ['reseller-panel', 'expiring'],
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: ResellerUserRow[] }>('/resellers/me/expiring');
      return res.data.data;
    },
  });
}

export function useResellerUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['reseller-panel', 'users', page, limit],
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: PaginatedResponse<ResellerUserRow> }>(
        `/users?page=${page}&limit=${limit}`,
      );
      return res.data.data;
    },
  });
}

export function useResellerPackages() {
  return useQuery({
    queryKey: ['reseller-panel', 'packages'],
    queryFn: async () => {
      const res = await resellerApi.get<{ success: boolean; data: Package[] }>('/packages');
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
