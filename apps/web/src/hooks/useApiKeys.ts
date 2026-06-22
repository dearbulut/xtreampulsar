import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ApiKey[] }>('/api-keys');
      return res.data.data;
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; permissions: string[]; expiresAt?: string }) =>
      api.post<{ success: boolean; data: ApiKey & { key: string } }>('/api-keys', dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
    onError: () => toast.error('API key oluşturulamadı'),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key silindi');
    },
    onError: () => toast.error('Silinemedi'),
  });
}
