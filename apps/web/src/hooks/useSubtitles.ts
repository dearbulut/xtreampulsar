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

export interface LibraryMatch {
  id: string;
  externalId: number;
  name: string;
  poster: string | null;
  subtitleCount: number;
}

export interface AttachedSubtitle {
  id: string;
  language: string;
  label: string | null;
  createdAt: string;
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

export function useMatchLibrary() {
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await api.get<{ success: boolean; data: LibraryMatch[] }>(`/subtitles/match?query=${encodeURIComponent(query)}`);
      return res.data.data;
    },
  });
}

export function useAttachSubtitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { streamId: string; fileId: number; language: string; label?: string }) => {
      const res = await api.post<{ success: boolean; data: { success: boolean; language: string } }>('/subtitles/attach', body);
      return res.data.data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['subtitles', 'stream', v.streamId] }),
  });
}

export function useStreamSubtitles(streamId: string | null) {
  return useQuery({
    queryKey: ['subtitles', 'stream', streamId],
    enabled: !!streamId,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AttachedSubtitle[] }>(`/subtitles/stream/${streamId}`);
      return res.data.data;
    },
  });
}

export function useRemoveAttached(streamId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/subtitles/attached/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subtitles', 'stream', streamId] }),
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
