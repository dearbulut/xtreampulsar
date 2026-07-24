import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface FeaturedEvent {
  id: string;
  title: string;
  description?: string | null;
  logoUrl?: string | null;
  startsAt?: string | null;
  streamId?: string | null;
  categoryId?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export type FeaturedInput = Partial<Omit<FeaturedEvent, 'id' | 'createdAt' | 'updatedAt'>>;

const KEY = ['featured'] as const;

export function useFeaturedEvents() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: FeaturedEvent[] }>('/featured');
      return res.data.data;
    },
  });
}

export function useCreateFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FeaturedInput) => api.post('/featured', body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Etkinlik eklendi'); },
    onError: () => toast.error('Ekleme başarısız'),
  });
}

export function useUpdateFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FeaturedInput }) => api.patch(`/featured/${id}`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Etkinlik güncellendi'); },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/featured/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Etkinlik silindi'); },
    onError: () => toast.error('Silme başarısız'),
  });
}
