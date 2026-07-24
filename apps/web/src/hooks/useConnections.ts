import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Connection, PaginatedResponse } from '@/types';

export interface ConnectionSummary {
  active: number;
  activeUsers: number;
  totalBytesIn: string;
  totalBytesOut: string;
}
export type LiveConnectionsData = PaginatedResponse<Connection> & { summary?: ConnectionSummary };

export function useLiveConnections(page = 1, limit = 50, autoRefresh = true) {
  return useQuery({
    queryKey: ['connections', 'live', page, limit],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: LiveConnectionsData }>(
        `/analytics/connections?page=${page}&limit=${limit}`,
      );
      return res.data.data;
    },
    refetchInterval: autoRefresh ? 3_000 : false,
    placeholderData: (prev) => prev,
  });
}

export function useKickConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.delete<{ data: { kicked: boolean } }>(`/analytics/connections/${connectionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Bağlantı kesildi');
    },
    onError: () => toast.error('Bağlantı kesilemedi'),
  });
}
