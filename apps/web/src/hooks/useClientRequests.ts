import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface ClientRequest {
  id: string;
  type: 'REPORT' | 'NEW_CHANNEL';
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  title: string;
  message?: string | null;
  adminNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  user?: { id: string; username: string } | null;
  stream?: { id: string; name: string } | null;
}

export function useClientRequests(params: { status?: string; type?: string } = {}) {
  return useQuery({
    queryKey: ['client-requests', 'list', params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.type) q.set('type', params.type);
      const res = await api.get<{ success: boolean; data: { items: ClientRequest[]; total: number } }>(
        `/client-requests?${q.toString()}`,
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useClientRequestStats() {
  return useQuery({
    queryKey: ['client-requests', 'stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { openReports: number; openRequests: number } }>(
        '/client-requests/stats',
      );
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useUpdateClientRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, adminNote }: { id: string; status: 'OPEN' | 'RESOLVED' | 'REJECTED'; adminNote?: string }) =>
      api.patch(`/client-requests/${id}`, { status, adminNote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-requests'] }),
  });
}

export function useAiSuggest() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{ success: boolean; data: { reply: string } }>(
        `/client-requests/${id}/ai-suggest`,
        {},
        { timeout: 40_000 },
      );
      return res.data.data.reply;
    },
  });
}
