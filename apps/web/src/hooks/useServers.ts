import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Server } from '@/types';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Server[] }>('/servers');
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      ip: string;
      port: number;
      maxClients: number;
      role: 'MAIN' | 'LOAD_BALANCER';
      location?: string;
    }) => api.post<{ success: boolean; data: Server }>('/servers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Sunucu eklendi');
    },
    onError: () => toast.error('Sunucu eklenemedi'),
  });
}

export function useUpdateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Server> }) =>
      api.patch(`/servers/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Sunucu güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/servers/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Sunucu silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useServerHealth() {
  return useMutation({
    mutationFn: (id: string) =>
      api.get<{ success: boolean; data: { status: string; responseTime: number; isOnline: boolean } }>(
        `/servers/${id}/health`,
      ),
  });
}
