import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Stream, PaginatedResponse } from '@/types';

interface StreamFilter {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  serverId?: string;
}

export function useStreams(filter: StreamFilter = {}) {
  const params = new URLSearchParams();
  if (filter.page) params.set('page', String(filter.page));
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.search) params.set('search', filter.search);
  if (filter.status) params.set('status', filter.status);
  if (filter.categoryId) params.set('categoryId', filter.categoryId);
  if (filter.serverId) params.set('serverId', filter.serverId);

  return useQuery({
    queryKey: ['streams', filter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Stream> }>(
        `/streams?${params.toString()}`,
      );
      return res.data.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useRestartStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/streams/${id}/restart`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream yeniden başlatıldı');
    },
    onError: () => toast.error('Yeniden başlatma başarısız'),
  });
}

export function useDeleteStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/streams/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useCreateStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Stream>) => api.post<{ success: boolean; data: Stream }>('/streams', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream oluşturuldu');
    },
    onError: () => toast.error('Oluşturma başarısız'),
  });
}

export function useUpdateStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Stream> }) =>
      api.patch<{ success: boolean; data: Stream }>(`/streams/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}
