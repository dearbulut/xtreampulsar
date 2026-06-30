import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { EPGSource } from '@/types';

export interface NowPlayingItem {
  id: string;
  title: string;
  start: string;
  stop: string;
  durationMin: number;
}

export interface EPGChannel {
  id: string;
  channelId: string;
  displayName: string;
  icon?: string;
  epgSourceId: string;
}

export interface EPGMapping {
  id: string;
  streamId: string;
  epgSourceId: string;
  epgChannelId: string;
  stream?: { id: string; name: string };
  epgSource?: { id: string; name: string };
}

export function useEPGSources() {
  return useQuery({
    queryKey: ['epg', 'sources'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: EPGSource[] }>('/epg/sources');
      return res.data.data;
    },
  });
}

export function useEPGChannels(sourceId: string, search?: string) {
  return useQuery({
    queryKey: ['epg', 'channels', sourceId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get<{ success: boolean; data: EPGChannel[] }>(
        `/epg/sources/${sourceId}/channels?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: !!sourceId,
  });
}

export function useEPGMappings() {
  return useQuery({
    queryKey: ['epg', 'mappings'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: EPGMapping[] }>('/epg/mappings');
      return res.data.data;
    },
  });
}

export function useCreateEPGSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; xmltvUrl: string; daysToKeep?: number; isActive?: boolean }) =>
      api.post<{ success: boolean; data: EPGSource }>('/epg/sources', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      toast.success('EPG kaynağı eklendi');
    },
    onError: () => toast.error('Ekleme başarısız'),
  });
}

export function useUpdateEPGSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EPGSource> }) =>
      api.patch(`/epg/sources/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      toast.success('Güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteEPGSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/epg/sources/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      toast.success('EPG kaynağı silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useParseEPGSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/epg/sources/${id}/parse`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      toast.success('EPG ayrıştırma başlatıldı');
    },
    onError: () => toast.error('Başlatma başarısız'),
  });
}

export function useParseAllEPGSources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ success: boolean; data: { total: number; success: number; failed: number } }>(
        '/epg/sources/parse-all',
      ),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      const { total, success, failed } = res.data.data;
      toast.success(`${success}/${total} kaynak güncellendi${failed > 0 ? ` (${failed} hata)` : ''}`);
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useMassAssignEPG() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { epgSourceId: string; minSimilarity?: number; stripPrefixes?: string[] }) =>
      api.post<{ success: boolean; data: { matched: number; total: number } }>('/epg/mass-assign', data),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['epg'] });
      toast.success(`${res.data.data.matched} stream eşleştirildi`);
    },
    onError: () => toast.error('Toplu eşleştirme başarısız'),
  });
}

export function useStreamNowPlaying(streamIds: string[]) {
  return useQuery<Record<string, { current: NowPlayingItem | null; next: NowPlayingItem | null }>>({
    queryKey: ['epg', 'now-playing', streamIds.join(',')],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        data: Record<string, { current: NowPlayingItem | null; next: NowPlayingItem | null }>;
      }>(`/epg/now-playing?streamIds=${streamIds.join(',')}`);
      return res.data.data ?? {};
    },
    enabled: streamIds.length > 0,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useCreateEPGMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { streamId: string; epgSourceId: string; epgChannelId: string }) =>
      api.post('/epg/mappings', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg', 'mappings'] });
      toast.success('Eşleştirme kaydedildi');
    },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}

export function useDeleteEPGMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/epg/mappings/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['epg', 'mappings'] });
      toast.success('Eşleştirme silindi');
    },
  });
}
