import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Reseller } from '@/types';

export function useResellers() {
  return useQuery({
    queryKey: ['resellers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Reseller[] }>('/resellers');
      return res.data.data;
    },
  });
}

export function useResellerStats(id: string) {
  return useQuery({
    queryKey: ['resellers', id, 'stats'],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        data: { totalUsers: number; activeUsers: number; expiredUsers: number; onlineConnections: number };
      }>(`/resellers/${id}/stats`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; email: string; password: string; credits?: number }) =>
      api.post<{ success: boolean; data: Reseller }>('/resellers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller oluşturuldu');
    },
    onError: () => toast.error('Reseller oluşturulamadı'),
  });
}

export function useAddCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason?: string }) =>
      api.post(`/resellers/${id}/add-credits`, { amount, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Kredi eklendi');
    },
    onError: () => toast.error('Kredi eklenemedi'),
  });
}

export function useDeleteReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/resellers/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}
