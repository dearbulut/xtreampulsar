import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export type WidgetType = 'TRIAL' | 'STORE' | 'RENEWAL';

export interface Widget {
  id: string;
  publicKey: string;
  name: string;
  type: WidgetType;
  enabled: boolean;
  title?: string | null;
  subtitle?: string | null;
  accentColor: string;
  trialPackageId?: string | null;
  trialDurationDays: number;
  allowedPackageIds: string[];
  successMessage?: string | null;
  redirectUrl?: string | null;
  perIpDailyLimit: number;
  oneTrialPerDevice: boolean;
  createdAt: string;
}

export interface WidgetLead {
  id: string;
  widgetId: string;
  type: string;
  ip?: string | null;
  email?: string | null;
  username?: string | null;
  result: string;
  message?: string | null;
  createdAt: string;
}

export interface WidgetPayload {
  name?: string;
  type?: WidgetType;
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  accentColor?: string;
  trialDurationDays?: number;
  allowedPackageIds?: string[];
  successMessage?: string;
  redirectUrl?: string;
  perIpDailyLimit?: number;
  oneTrialPerDevice?: boolean;
}

export function useWidgets() {
  return useQuery({
    queryKey: ['widgets'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Widget[] }>('/widgets');
      return res.data.data;
    },
  });
}

export function useWidgetLeads(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['widgets', id, 'leads'],
    enabled: enabled && !!id,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: WidgetLead[] }>(`/widgets/${id}/leads`);
      return res.data.data;
    },
  });
}

export function useCreateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WidgetPayload) => api.post('/widgets', payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['widgets'] }); },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}

export function useUpdateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WidgetPayload }) => api.patch(`/widgets/${id}`, payload),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['widgets'] }); },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}

export function useDeleteWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/widgets/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['widgets'] }); },
  });
}

// ── Public (hosted page — no auth) ──────────────────────────────────
export interface PublicWidgetConfig {
  type: WidgetType;
  title?: string | null;
  subtitle?: string | null;
  accentColor: string;
  enabled: boolean;
  trialDurationDays?: number;
  packages?: { id: string; name: string; durationDays: number; maxConnections: number; price: number; description?: string }[];
}

export interface WidgetSubmitResult {
  type: WidgetType;
  username?: string;
  password?: string;
  m3uUrl?: string;
  orderId?: string;
  message?: string | null;
  redirectUrl?: string | null;
}

export function usePublicWidget(key: string | undefined) {
  return useQuery({
    queryKey: ['public-widget', key],
    enabled: !!key,
    retry: false,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PublicWidgetConfig }>(`/public/widgets/${key}`);
      return res.data.data;
    },
  });
}

export function useSubmitPublicWidget(key: string | undefined) {
  return useMutation({
    mutationFn: async (body: { email?: string; packageId?: string; username?: string; deviceId?: string }) => {
      const res = await api.post<{ success: boolean; data: WidgetSubmitResult }>(`/public/widgets/${key}/submit`, body);
      return res.data.data;
    },
  });
}
