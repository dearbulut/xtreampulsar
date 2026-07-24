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
