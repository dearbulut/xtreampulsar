import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Package } from '@/types';

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Package[] }>('/packages');
      return res.data.data;
    },
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      durationDays: number;
      maxConnections: number;
      creditCost: number;
      price?: number;
      description?: string;
    }) => api.post<{ success: boolean; data: Package }>('/packages', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket oluşturuldu');
    },
    onError: () => toast.error('Oluşturma başarısız'),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Package> }) =>
      api.patch(`/packages/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/packages/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Paket silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}
