import { useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface BulkActionResult {
  affected: number;
  results?: { userId: string; username: string; newPassword: string }[];
}

export function useBulkAction() {
  return useMutation({
    mutationFn: async (body: { action: string; userIds: string[]; value?: string | number }) => {
      const res = await api.post<{ success: boolean; data: BulkActionResult }>('/users/bulk', body);
      return res.data.data;
    },
    onError: () => toast.error('Toplu işlem başarısız'),
  });
}
