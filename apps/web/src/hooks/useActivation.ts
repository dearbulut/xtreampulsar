import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface ActivationCode {
  id: string;
  code: string;
  durationDays: number;
  maxConnections: number | null;
  status: 'ACTIVE' | 'USED' | 'DISABLED';
  note: string | null;
  usedByUsername: string | null;
  usedAt: string | null;
  createdAt: string;
}

export function useActivationCodes(status?: string) {
  return useQuery({
    queryKey: ['activation-codes', status ?? 'all'],
    queryFn: async () => {
      const q = status ? `?status=${status}` : '';
      const res = await api.get<{ success: boolean; data: { items: ActivationCode[]; total: number } }>(`/activation-codes${q}`);
      return res.data.data;
    },
  });
}

export function useGenerateCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { count: number; durationDays: number; maxConnections?: number; note?: string }) => {
      const res = await api.post<{ success: boolean; data: { generated: number; codes: string[] } }>('/activation-codes/generate', body);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activation-codes'] }),
  });
}

export function useDisableCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/activation-codes/${id}/disable`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activation-codes'] }),
  });
}
