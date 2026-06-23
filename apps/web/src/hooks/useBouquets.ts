import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface Bouquet {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count?: { categories: number; bouquetStreams: number; userBouquets: number };
}

export function useBouquets() {
  return useQuery({
    queryKey: ['bouquets'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Bouquet[] }>('/bouquets');
      return res.data.data;
    },
  });
}

export function useCreateBouquet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<{ success: boolean; data: Bouquet }>('/bouquets', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success("Bouquet oluşturuldu");
    },
    onError: () => toast.error('Oluşturma başarısız'),
  });
}

export function useUpdateBouquet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bouquet> }) =>
      api.patch(`/bouquets/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success('Güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteBouquet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/bouquets/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success('Bouquet silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useResignBouquet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/bouquets/${id}/resign`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success('ReSign tamamlandı');
    },
    onError: () => toast.error('ReSign başarısız'),
  });
}

export function useSetBouquetStreams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, streamIds }: { id: string; streamIds: string[] }) =>
      api.post(`/bouquets/${id}/streams`, { streamIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success('Stream listesi güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export interface BouquetStream {
  id: string;
  name: string;
  externalId: number;
  status: string;
  tvgLogo?: string;
  isActive: boolean;
  category?: { id: string; name: string; type: string };
}

export function useBouquetStreams(bouquetId: string | null) {
  return useQuery({
    queryKey: ['bouquet-streams', bouquetId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: BouquetStream[] }>(`/bouquets/${bouquetId}/streams`);
      return res.data.data;
    },
    enabled: !!bouquetId,
  });
}

export function useReplaceBouquetStreams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, streamIds }: { id: string; streamIds: string[] }) =>
      api.put(`/bouquets/${id}/streams`, { streamIds }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      void qc.invalidateQueries({ queryKey: ['bouquet-streams', vars.id] });
      toast.success('Bouquet stream listesi güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useCloneBouquet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/bouquets/${id}/clone`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bouquets'] });
      toast.success('Bouquet kopyalandı');
    },
    onError: () => toast.error('Kopyalama başarısız'),
  });
}
