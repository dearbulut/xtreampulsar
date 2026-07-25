import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

function serverMsg(e: unknown, fallback: string): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  return m || fallback;
}

export interface YtResolveResult {
  title: string;
  url: string;
  isLive: boolean;
  thumbnail: string;
}

export function useYouTubeResolve() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.post<{ success: boolean; data: YtResolveResult }>('/youtube/resolve', { url });
      return res.data.data;
    },
    onError: (e) => toast.error(serverMsg(e, 'YouTube URL çözülemedi'), { duration: 8000 }),
  });
}

export function useYouTubeImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; categoryId: string; name?: string; streamMode?: string }) =>
      api.post('/youtube/import', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      toast.success('YouTube kaynağı yayın olarak eklendi');
    },
    onError: (e) => toast.error(serverMsg(e, 'İçe aktarma başarısız'), { duration: 8000 }),
  });
}
