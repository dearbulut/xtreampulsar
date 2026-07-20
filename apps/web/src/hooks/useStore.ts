import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface StorePackage {
  id: string;
  name: string;
  durationDays: number;
  maxConnections: number;
  price: number;
  description: string | null;
}

export type StoreOrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED';

export interface StoreOrder {
  id: string;
  packageId: string;
  packageName: string;
  price: number;
  contactEmail: string;
  desiredUsername: string | null;
  note: string | null;
  status: StoreOrderStatus;
  provisionedUsername: string | null;
  provisionedPassword: string | null;
  createdAt: string;
}

// ── Public (misafir mağaza) ──────────────────────────────────────────
export function usePublicPackages() {
  return useQuery({
    queryKey: ['store-packages'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StorePackage[] }>('/store/packages');
      return res.data.data;
    },
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (body: { packageId: string; contactEmail: string; desiredUsername?: string; note?: string }) => {
      const res = await api.post<{ success: boolean; data: { id: string; status: string } }>('/store/orders', body);
      return res.data.data;
    },
  });
}

// ── Admin ────────────────────────────────────────────────────────────
export function useStoreOrders(status?: string) {
  return useQuery({
    queryKey: ['store-orders', status ?? 'all'],
    queryFn: async () => {
      const q = status ? `?status=${status}` : '';
      const res = await api.get<{ success: boolean; data: { items: StoreOrder[]; total: number; pending: number } }>(`/store/orders${q}`);
      return res.data.data;
    },
  });
}

export function useFulfillOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ success: boolean; data: StoreOrder }>(`/store/orders/${id}/fulfill`, {});
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-orders'] }),
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; status: StoreOrderStatus }) =>
      api.post(`/store/orders/${payload.id}/status`, { status: payload.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-orders'] }),
  });
}
