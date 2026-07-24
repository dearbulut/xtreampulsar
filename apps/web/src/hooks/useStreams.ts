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
  type?: string;
  isRadio?: boolean;
  resolution?: string;
  qualityScore?: string;
  healthStatus?: string;
  videoCodec?: string;
  updatedAfter?: string;
  refetchInterval?: number | false;
}

export function useStreams(filter: StreamFilter = {}) {
  const { refetchInterval, ...apiFilter } = filter;
  const params = new URLSearchParams();
  if (apiFilter.page) params.set('page', String(apiFilter.page));
  if (apiFilter.limit) params.set('limit', String(apiFilter.limit));
  if (apiFilter.search) params.set('search', apiFilter.search);
  if (apiFilter.status) params.set('status', apiFilter.status);
  if (apiFilter.categoryId) params.set('categoryId', apiFilter.categoryId);
  if (apiFilter.serverId) params.set('serverId', apiFilter.serverId);
  if (apiFilter.type) params.set('type', apiFilter.type);
  if (apiFilter.isRadio !== undefined) params.set('isRadio', apiFilter.isRadio ? 'true' : 'false');
  if (apiFilter.resolution) params.set('resolution', apiFilter.resolution);
  if (apiFilter.qualityScore) params.set('qualityScore', apiFilter.qualityScore);
  if (apiFilter.healthStatus) params.set('healthStatus', apiFilter.healthStatus);
  if (apiFilter.videoCodec) params.set('videoCodec', apiFilter.videoCodec);
  if (apiFilter.updatedAfter) params.set('updatedAfter', apiFilter.updatedAfter);

  return useQuery({
    queryKey: ['streams', apiFilter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Stream> }>(
        `/streams?${params.toString()}`,
      );
      return res.data.data;
    },
    placeholderData: (prev) => prev,
    refetchInterval: refetchInterval ?? false,
  });
}

export function useStartStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: { status: string; pid: number | null } }>(`/streams/${id}/start`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream başlatıldı');
    },
    onError: () => toast.error('Başlatma başarısız'),
  });
}

export function useStopStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/streams/${id}/stop`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream durduruldu');
    },
    onError: () => toast.error('Durdurma başarısız'),
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
    mutationFn: (data: Partial<Stream> & Record<string, unknown>) => api.post<{ success: boolean; data: Stream }>('/streams', data),
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

export function useUpdateStreamBackupUrls() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, backupUrls }: { id: string; backupUrls: string[] }) =>
      api.put(`/streams/${id}/backup-urls`, { backupUrls }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Yedek URL\'ler kaydedildi');
    },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}
