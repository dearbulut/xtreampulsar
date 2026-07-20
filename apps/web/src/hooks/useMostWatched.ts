import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

export type WatchRange = '24h' | '7d' | '30d';
export type WatchType = 'all' | 'live' | 'vod' | 'series';

export interface MostWatchedItem {
  streamId: string;
  name: string;
  poster: string | null;
  category: string | null;
  type: 'LIVE' | 'VOD' | 'SERIES';
  sessions: number;
  uniqueViewers: number;
  watchMinutes: number;
}

export function useMostWatched(range: WatchRange, type: WatchType, limit = 30) {
  return useQuery({
    queryKey: ['most-watched', range, type, limit],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MostWatchedItem[] }>(
        `/analytics/most-watched?range=${range}&type=${type}&limit=${limit}`,
      );
      return res.data.data;
    },
  });
}
