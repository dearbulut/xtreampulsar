import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Episode } from '@/types';

type EpisodePayload = {
  season: number;
  episode: number;
  title?: string;
  primaryUrl: string;
  containerExtension?: string;
  plot?: string;
  durationSecs?: number;
  tmdbRating?: number;
  releaseDate?: string;
  cover?: string;
};

function isConflict(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 409;
}

export function useEpisodes(seriesId: string) {
  return useQuery({
    queryKey: ['episodes', seriesId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Episode[] }>(
        `/streams/${seriesId}/episodes`,
      );
      return res.data.data;
    },
    enabled: !!seriesId,
  });
}

export function useCreateEpisode(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EpisodePayload) =>
      api.post<{ success: boolean; data: Episode }>(`/streams/${seriesId}/episodes`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['episodes', seriesId] });
      toast.success('Bölüm eklendi');
    },
    onError: (err) =>
      toast.error(isConflict(err) ? 'Bu sezon/bölüm zaten var' : 'Ekleme başarısız'),
  });
}

export function useUpdateEpisode(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, data }: { episodeId: string; data: Partial<EpisodePayload> }) =>
      api.patch<{ success: boolean; data: Episode }>(
        `/streams/${seriesId}/episodes/${episodeId}`,
        data,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['episodes', seriesId] });
      toast.success('Bölüm güncellendi');
    },
    onError: (err) =>
      toast.error(isConflict(err) ? 'Bu sezon/bölüm zaten var' : 'Güncelleme başarısız'),
  });
}

export function useDeleteEpisode(seriesId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (episodeId: string) =>
      api.delete(`/streams/${seriesId}/episodes/${episodeId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['episodes', seriesId] });
      toast.success('Bölüm silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}
