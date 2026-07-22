import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface DownloadJob {
  id: string;
  url: string;
  filename: string;
  status: 'QUEUED' | 'DOWNLOADING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  totalBytes: string;      // BigInt → JSON string
  downloadedBytes: string; // BigInt → JSON string
  speedBps: number;
  connections: number;
  error: string | null;
  categoryId: string | null;
  createdStreamId: string | null;
  autoVod: boolean;
  priority: number;
  createdAt: string;
}

export interface DownloadConfig {
  downloadSpeedKbps: number;
  downloadConcurrency: number;
  downloadAutoVod: boolean;
}

export interface DiskUsage { used: number; total: number; free: number }

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DownloadJob[] }>('/downloads');
      return res.data.data;
    },
    refetchInterval: 2000,
  });
}

export function useCreateDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { url: string; filename?: string; categoryId?: string; connections?: number; autoVod?: boolean }) =>
      api.post('/downloads', dto),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['downloads'] }); toast.success('İndirme kuyruğa eklendi'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Eklenemedi'),
  });
}

function useAction(action: string, okMsg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/downloads/${id}/${action}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['downloads'] }); if (okMsg) toast.success(okMsg); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'İşlem başarısız'),
  });
}

export const usePauseDownload = () => useAction('pause');
export const useResumeDownload = () => useAction('resume');
export const useCancelDownload = () => useAction('cancel');
export const useAddDownloadToVod = () => useAction('add-to-vod', 'VOD kütüphanesine eklendi');

export function useDeleteDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/downloads/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['downloads'] }); toast.success('Silindi'); },
    onError: () => toast.error('Silinemedi'),
  });
}

export function useDownloadConfig() {
  return useQuery({
    queryKey: ['download-config'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DownloadConfig }>('/downloads/config');
      return res.data.data;
    },
  });
}

export function useUpdateDownloadConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<DownloadConfig>) => api.patch('/downloads/config', dto),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['download-config'] }); toast.success('Ayar kaydedildi'); },
    onError: () => toast.error('Kaydedilemedi'),
  });
}

export function useDiskUsage() {
  return useQuery({
    queryKey: ['download-disk'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DiskUsage }>('/downloads/disk');
      return res.data.data;
    },
    refetchInterval: 10000,
  });
}

export function useBatchDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { text: string; categoryId?: string; connections?: number; autoVod?: boolean }) =>
      api.post<{ success: boolean; data: { created: number } }>('/downloads/batch', dto),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['downloads'] }); toast.success(`${r.data.data.created} indirme eklendi`); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Eklenemedi'),
  });
}

export const useBumpPriority = () => useAction('priority');

export function useRetryFailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/downloads/retry-failed'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['downloads'] }); toast.success('Başarısızlar yeniden kuyruğa alındı'); },
  });
}

export function useClearFinished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/downloads/clear-finished'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['downloads'] }); toast.success('Temizlendi'); },
  });
}
