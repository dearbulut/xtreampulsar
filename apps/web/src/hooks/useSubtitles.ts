import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface SubtitleConfig {
  enabled: boolean;
  apiKey: string;
  username: string;
  passwordSet: boolean;
}

export interface SubtitleResult {
  fileId: number | null;
  language: string;
  release: string;
  downloads: number;
  fps: number | null;
  hearingImpaired: boolean;
}

export function useSubtitleConfig() {
  return useQuery({
    queryKey: ['subtitles', 'config'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SubtitleConfig }>('/subtitles/config');
      return res.data.data;
    },
  });
}

export function useUpdateSubtitleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { enabled?: boolean; apiKey?: string; username?: string; password?: string }) => {
      const res = await api.patch<{ success: boolean; data: SubtitleConfig }>('/subtitles/config', body);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subtitles', 'config'] }),
  });
}

export function useSearchSubtitles() {
  return useMutation({
    mutationFn: async (params: { query: string; languages: string }) => {
      const res = await api.get<{ success: boolean; data: SubtitleResult[] }>(
        `/subtitles/search?query=${encodeURIComponent(params.query)}&languages=${encodeURIComponent(params.languages)}`,
      );
      return res.data.data;
    },
  });
}

export async function downloadSubtitle(fileId: number, releaseName: string): Promise<void> {
  const res = await api.get(`/subtitles/download/${fileId}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(releaseName || 'subtitle').replace(/[^\w.-]+/g, '_').slice(0, 60)}.srt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
