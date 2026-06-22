import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

interface BulkRenewResult {
  renewed: number;
  failed: number;
  errors: string[];
}

export function useBulkRenew() {
  return useMutation({
    mutationFn: async (body: { userIds: string[]; packageId: string }) => {
      const res = await api.post<{ success: boolean; data: BulkRenewResult }>('/users/bulk-renew', body);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.renewed} kullanıcı yenilendi${data.failed > 0 ? `, ${data.failed} başarısız` : ''}`);
    },
    onError: () => toast.error('Toplu yenileme başarısız'),
  });
}

export function useExpiringCount(days = 7) {
  return useQuery<number>({
    queryKey: ['expiring-count', days],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: number }>(`/users/expiring-count?days=${days}`);
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
