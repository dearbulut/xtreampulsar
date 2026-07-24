import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface WatchConfig {
  enabled: boolean;
  path: string | null;
  bouquetId: string | null;
  intervalMins: number;
}

export interface WatchImport {
  id: string;
  path: string;
  kind: 'MOVIE' | 'EPISODE';
  title: string;
  season?: number | null;
  episode?: number | null;
  status: string;
  message?: string | null;
  createdAt: string;
}

export function useWatchConfig() {
  return useQuery({
    queryKey: ['watch-folder', 'config'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: WatchConfig }>('/watch-folder/config');
      return res.data.data;
    },
  });
}

export function useWatchImports() {
  return useQuery({
    queryKey: ['watch-folder', 'imports'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: WatchImport[] }>('/watch-folder/imports');
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export function useUpdateWatchConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<WatchConfig>) => api.patch('/watch-folder/config', payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['watch-folder'] }); toast.success('Kaydedildi'); },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}

export function useScanWatchFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { scanned: number; imported: number; skipped: number; errors: number } }>('/watch-folder/scan');
      return res.data.data;
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['watch-folder'] });
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success(`Tarandı: +${r.imported} içe aktarıldı, ${r.errors} hata`);
    },
    onError: () => toast.error('Tarama başarısız'),
  });
}
