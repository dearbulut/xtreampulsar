import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { User, PaginatedResponse } from '@/types';

interface UserFilter {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  resellerId?: string;
}

export function useUsers(filter: UserFilter = {}) {
  const params = new URLSearchParams();
  if (filter.page) params.set('page', String(filter.page));
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.search) params.set('search', filter.search);
  if (filter.status) params.set('status', filter.status);
  if (filter.resellerId) params.set('resellerId', filter.resellerId);

  return useQuery({
    queryKey: ['users', filter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<User> }>(
        `/users?${params.toString()}`,
      );
      return res.data.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      username: string;
      password: string;
      maxConnections: number;
      expiresAt: string;
      resellerId?: string;
      notes?: string;
      bouquetIds?: string[];
    }) => api.post<{ success: boolean; data: User }>('/users', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Kullanıcı oluşturuldu');
    },
    onError: () => toast.error('Kullanıcı oluşturulamadı'),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> & { password?: string; expiresAt?: string } }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Kullanıcı güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useExtendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) =>
      api.post(`/users/${id}/extend`, { days }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Süre uzatıldı');
    },
    onError: () => toast.error('Uzatma başarısız'),
  });
}

export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/ban`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Kullanıcı yasaklandı');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/unban`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Yasak kaldırıldı');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useKickUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/kick`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Bağlantılar kesildi');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Kullanıcı silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}
