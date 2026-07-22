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
  createdAt: string;
}

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
    mutationFn: (dto: { url: string; filename?: string; categoryId?: string; connections?: number }) =>
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
