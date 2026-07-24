import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Enigma2Device } from '@/types';

const KEY = ['enigma2-devices'] as const;

export function useEnigma2Devices(search?: string) {
  return useQuery({
    queryKey: [...KEY, search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await api.get<{ data: Enigma2Device[] }>(`/enigma2-devices${params}`);
      const raw = res.data.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });
}

export function useCreateEnigma2Device() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { mac: string; userId?: string; deviceName?: string; boxType?: string; oeVersion?: string }) =>
      api.post<{ data: Enigma2Device }>('/enigma2-devices', dto).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Cihaz eklendi'); },
    onError: () => toast.error('Cihaz eklenemedi'),
  });
}

export function useUpdateEnigma2Device() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; userId?: string | null; deviceName?: string | null; boxType?: string | null; oeVersion?: string }) =>
      api.put<{ data: Enigma2Device }>(`/enigma2-devices/${id}`, body).then((r) => r.data.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Cihaz güncellendi'); },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteEnigma2Device() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/enigma2-devices/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success('Cihaz silindi'); },
    onError: () => toast.error('Silme başarısız'),
  });
}
