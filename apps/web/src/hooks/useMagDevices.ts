import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { MagDevice } from '@/types';

const KEY = ['mag-devices'] as const;

export function useMagDevices(search?: string) {
  return useQuery({
    queryKey: [...KEY, search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ data: MagDevice[] }>(`/mag-devices${params}`);
      const raw = res.data.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });
}

export function useCreateMagDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { mac: string; userId?: string }) =>
      api.post<{ data: MagDevice }>('/mag-devices', dto).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Cihaz eklendi');
    },
    onError: () => toast.error('Cihaz eklenemedi'),
  });
}

export function useUpdateMagDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string | null }) =>
      api.put<{ data: MagDevice }>(`/mag-devices/${id}`, { userId }).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Cihaz güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteMagDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/mag-devices/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Cihaz silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}
