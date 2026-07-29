import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import i18n from 'i18next';

interface StreamMetadata {
  id: string;
  name: string;
  tmdbId: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseYear: number | null;
  tmdbRating: number | null;
  tmdbGenres: string[];
}

export function useStreamMetadata(streamId: string) {
  return useQuery<StreamMetadata>({
    queryKey: ['stream-metadata', streamId],
    queryFn: async () => {
      const res = await api.get<{ data: StreamMetadata }>(`/streams/${streamId}/metadata`);
      return res.data.data;
    },
    enabled: !!streamId,
    staleTime: 60_000,
  });
}

export function useEnrichStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type?: 'VOD' | 'SERIES' }) => {
      const res = await api.post<{ data: { success: boolean; message: string } }>(
        `/streams/${id}/enrich`,
        { type },
      );
      return res.data.data;
    },
    onSuccess: (data, vars) => {
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
      void qc.invalidateQueries({ queryKey: ['streams'] });
      void qc.invalidateQueries({ queryKey: ['stream-metadata', vars.id] });
    },
    onError: () => toast.error('Meta veri çekilemedi'),
  });
}

export function useReorderStreams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (streamIds: string[]) =>
      api.patch('/streams/reorder', { streamIds }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['streams'] }),
  });
}

export function useBulkMoveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ streamIds, categoryId }: { streamIds: string[]; categoryId: string }) =>
      api.patch('/streams/bulk-move', { streamIds, categoryId }),
    onSuccess: () => {
      toast.success('Kategori güncellendi');
      void qc.invalidateQueries({ queryKey: ['streams'] });
    },
    onError: () => toast.error('Taşıma başarısız'),
  });
}

// ─── Toplu duzenleme ─────────────────────────────────────────────────────────

/** Toplu duzenlemede hedef kumeyi belirleyen filtre (yayin listesiyle ayni). */
export interface BulkStreamFilter {
  search?: string;
  categoryId?: string;
  serverId?: string;
  providerId?: string;
  type?: string;
  status?: string;
  healthStatus?: string;
  streamMode?: string;
  isRadio?: boolean;
  isActive?: boolean;
}

/** Uygulanacak degisiklikler; verilmeyen alanlara dokunulmaz. */
export interface BulkStreamData {
  streamMode?: string;
  transcodeProfileId?: string;
  categoryId?: string;
  isActive?: boolean;
  streamUserAgent?: string;
  httpHeaders?: string;
  httpCookie?: string;
}

export interface BulkUpdatePayload {
  streamIds?: string[];
  filter?: BulkStreamFilter;
  confirmAll?: boolean;
  data: BulkStreamData;
}

/** Kac yayinin etkilenecegini sorar; hicbir sey yazmaz (onay ekrani icin). */
export async function previewBulkUpdate(payload: BulkUpdatePayload): Promise<number> {
  const res = await api.patch<{ data: { matched: number } }>(
    '/streams/bulk-update?dryRun=1',
    { ...payload, data: payload.data ?? {} },
  );
  return res.data.data.matched;
}

export function useBulkUpdateStreams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkUpdatePayload) => {
      const res = await api.patch<{ data: { matched: number; updated: number } }>(
        '/streams/bulk-update',
        payload,
      );
      return res.data.data;
    },
    onSuccess: (d) => {
      toast.success(i18n.t('streams.bulkUpdated', { n: d.updated }));
      void qc.invalidateQueries({ queryKey: ['streams'] });
    },
    onError: () => toast.error(i18n.t('streams.bulkUpdateFailed')),
  });
}
