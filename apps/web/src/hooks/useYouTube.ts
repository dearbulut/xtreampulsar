import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

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
    onError: () => toast.error('YouTube URL çözülemedi'),
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
    onError: () => toast.error('İçe aktarma başarısız'),
  });
}
