import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface M3uSource {
  id: string;
  name: string;
  url: string;
  defaultType: string;
  defaultBouquetId?: string | null;
  conflictMode: string;
  enabled: boolean;
  intervalMinutes: number;
  lastSyncedAt?: string | null;
  lastStatus?: string | null;
  lastMessage?: string | null;
  createdAt: string;
}

export interface M3uSourceInput {
  name: string;
  url: string;
  defaultType?: string;
  conflictMode?: string;
  enabled?: boolean;
  intervalMinutes?: number;
}

export function useM3uSources() {
  return useQuery({
    queryKey: ['m3u-sources'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: M3uSource[] }>('/m3u-sources');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useCreateM3uSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: M3uSourceInput) => api.post('/m3u-sources', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m3u-sources'] }),
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Kaydedilemedi'),
  });
}

export function useUpdateM3uSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: M3uSourceInput & { id: string }) => api.patch(`/m3u-sources/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m3u-sources'] }),
  });
}

export function useDeleteM3uSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/m3u-sources/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m3u-sources'] }),
  });
}

export function useSyncM3uSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/m3u-sources/${id}/sync`),
    onSuccess: () => {
      toast.success('Senkron başlatıldı');
      qc.invalidateQueries({ queryKey: ['m3u-sources'] });
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Senkron başarısız'),
  });
}
