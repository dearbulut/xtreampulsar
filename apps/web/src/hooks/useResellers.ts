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

export function useResellerHierarchy() {
  return useQuery({
    queryKey: ['resellers', 'hierarchy'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Reseller[] }>('/resellers/hierarchy');
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
    mutationFn: (data: { username: string; email?: string; password: string; credits?: number; tier?: string; notes?: string; parentId?: string }) =>
      api.post<{ success: boolean; data: Reseller }>('/resellers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller oluşturuldu');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Reseller oluşturulamadı');
    },
  });
}

export function useUpdateReseller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; tier?: string; isActive?: boolean; parentId?: string | null; notes?: string; maxUsers?: number }) =>
      api.put<{ success: boolean; data: Reseller }>(`/resellers/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Reseller güncellendi');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Güncelleme başarısız');
    },
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

export function useAdminTransferCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fromId, toResellerId, amount }: { fromId: string; toResellerId: string; amount: number }) =>
      api.post(`/resellers/${fromId}/transfer-credits`, { toResellerId, amount }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['resellers'] });
      toast.success('Kredi transferi yapıldı');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Transfer başarısız');
    },
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
