import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export type CommissionStatus = 'PENDING' | 'PAID';

export interface Commission {
  id: string;
  amount: number;
  note: string | null;
  status: CommissionStatus;
  createdAt: string;
  paidAt: string | null;
  earner: string;
  source: string | null;
}

export interface CommissionList {
  items: Commission[];
  total: number;
  page: number;
  limit: number;
  pendingTotal: number;
  paidTotal: number;
}

export function useCommissions(status?: string) {
  return useQuery({
    queryKey: ['commissions', status ?? 'all'],
    queryFn: async () => {
      const q = status ? `?status=${status}` : '';
      const res = await api.get<{ success: boolean; data: CommissionList }>(`/commissions${q}`);
      return res.data.data;
    },
  });
}

export function useCommissionRate() {
  return useQuery({
    queryKey: ['commissions', 'rate'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { rate: number } }>('/commissions/rate');
      return res.data.data.rate;
    },
  });
}

export function useSetCommissionRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rate: number) => api.patch('/commissions/rate', { rate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions', 'rate'] }),
  });
}

export function useMarkCommissionPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/commissions/${id}/paid`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}

export function useDeleteCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/commissions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}

export function useSetReferrer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { resellerId: string; code: string }) => api.post(`/commissions/reseller/${p.resellerId}/referrer`, { code: p.code }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commissions'] }),
  });
}
