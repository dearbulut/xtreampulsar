import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface StreamTracks {
  video: { codec: string | null; resolution: string | null; fps: number | null } | null;
  audio: Array<{ index: number; codec: string | null; language: string | null; channels: number | null; title: string | null }>;
  subtitle: Array<{ index: number; codec: string | null; language: string | null; title: string | null }>;
}

export function useStreamTracks(streamId: string | null) {
  return useQuery({
    queryKey: ['stream-tracks', streamId],
    enabled: !!streamId,
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StreamTracks }>(`/streams/${streamId}/tracks`);
      return res.data.data;
    },
  });
}
