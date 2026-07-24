import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface Provider {
  id: string;
  name: string;
  type: string;
  host: string;
  username?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastCheckedAt?: string | null;
  lastError?: string | null;
  maxConnections?: number | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  // Mirror (Increment 2)
  mirrorBouquetId?: string | null;
  mirrorServerId?: string | null;
  outputExt?: string;
  dropPolicy?: string;
  importLive?: boolean;
  importVod?: boolean;
  importSeries?: boolean;
  lastSyncedAt?: string | null;
  lastSyncAdded?: number | null;
  lastSyncUpdated?: number | null;
  lastSyncRemoved?: number | null;
  lastSyncTotal?: number | null;
}

export interface BrowseCategory {
  category_id: string;
  category_name: string;
  count: number;
}
export interface BrowseTypeResult {
  categories: BrowseCategory[];
  total: number;
  error?: string;
}
export interface ProviderBrowse {
  live: BrowseTypeResult;
  vod: BrowseTypeResult;
  series: BrowseTypeResult;
}

export interface SyncPayload {
  bouquetId?: string;
  serverId?: string;
  outputExt?: 'ts' | 'm3u8';
  dropPolicy?: 'KEEP' | 'DISABLE' | 'DELETE';
  importLive?: boolean;
  importVod?: boolean;
  importSeries?: boolean;
  liveCategoryIds?: string[];
  vodCategoryIds?: string[];
  seriesCategoryIds?: string[];
}
export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
  bouquetId: string;
  capped?: boolean;
}

export interface ProviderPreview {
  host: string;
  username?: string;
  password?: string;
  ok: boolean;
  status?: string;
  expiresAt?: string | null;
  maxConnections?: number | null;
  error?: string;
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Provider[] }>('/providers');
      return res.data.data;
    },
  });
}

export function usePreviewProvider() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.post<{ success: boolean; data: ProviderPreview }>('/providers/preview', { url });
      return res.data.data;
    },
  });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { url?: string; name?: string; userAgent?: string }) =>
      api.post('/providers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Sağlayıcı eklendi');
    },
    onError: () => toast.error('Ekleme başarısız — URL/kimlik bilgilerini kontrol edin'),
  });
}

export function useReverifyProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/providers/${id}/verify`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Yeniden doğrulandı');
    },
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Silindi');
    },
  });
}

export function useBrowseProvider(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['providers', id, 'browse'],
    enabled: enabled && !!id,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ProviderBrowse }>(`/providers/${id}/browse`);
      return res.data.data;
    },
  });
}

export function useSyncProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: SyncPayload }) => {
      const res = await api.post<{ success: boolean; data: SyncResult }>(`/providers/${id}/sync`, payload);
      return res.data.data;
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['providers'] });
      void qc.invalidateQueries({ queryKey: ['streams'] });
      void qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(`Aynalandı: +${r.added} yeni, ${r.updated} güncel, ${r.removed} kaldırıldı`);
    },
    onError: () => toast.error('Aynalama başarısız'),
  });
}
