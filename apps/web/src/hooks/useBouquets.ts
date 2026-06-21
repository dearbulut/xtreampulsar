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
  _count?: { categories: number; bouquetStreams: number };
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
