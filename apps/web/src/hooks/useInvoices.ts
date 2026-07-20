import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export type InvoiceStatus = 'UNPAID' | 'PAID' | 'CANCELLED';

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string | null;
  description: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  source: 'MANUAL' | 'STORE';
  sourceId: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPaid: number;
  totalUnpaid: number;
}

export function useInvoices(status?: string) {
  return useQuery({
    queryKey: ['invoices', status ?? 'all'],
    queryFn: async () => {
      const q = status ? `?status=${status}` : '';
      const res = await api.get<{ success: boolean; data: InvoiceListResponse }>(`/invoices${q}`);
      return res.data.data;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { customerName: string; customerEmail?: string; description: string; amount: number; notes?: string }) => {
      const res = await api.post<{ success: boolean; data: Invoice }>('/invoices', body);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useInvoiceFromOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await api.post<{ success: boolean; data: Invoice }>(`/invoices/from-order/${orderId}`, {});
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useSetInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'paid' | 'unpaid' | 'cancel' }) =>
      api.post(`/invoices/${id}/${status}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
