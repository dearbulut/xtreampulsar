import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Webhook } from '@/types';

const KEY = ['webhooks'] as const;

export function useWebhooks() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ data: Webhook[] }>('/webhooks');
      const raw = res.data.data ?? res.data;
      return Array.isArray(raw) ? raw : [];
    },
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; url: string; secret?: string; events: string[] }) =>
      api.post<{ success: boolean; data: Webhook }>('/webhooks', dto).then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Webhook oluşturuldu');
    },
    onError: () => toast.error('Oluşturma başarısız'),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: Partial<Webhook> & { id: string }) =>
      api.put<{ success: boolean; data: Webhook }>(`/webhooks/${id}`, dto).then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Webhook güncellendi');
    },
    onError: () => toast.error('Güncelleme başarısız'),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Webhook silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ success: boolean; data: { status: number | null; ok: boolean; error?: string } }>(`/webhooks/${id}/test`)
        .then((r) => (r.data?.data ?? r.data) as { status: number | null; ok: boolean; error?: string }),
  });
}
