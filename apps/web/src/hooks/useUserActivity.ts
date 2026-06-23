import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface ActivityItem {
  id: string;
  userId: string;
  action: string;
  streamId: string | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  deviceType: string | null;
  duration: number | null;
  endedAt: string | null;
  createdAt: string;
}

export interface ActivityResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ActivityFilters {
  action?: string;
  startDate?: string;
  endDate?: string;
}

export function useUserActivity(
  userId: string,
  page = 1,
  limit = 50,
  filters: ActivityFilters = {},
) {
  return useQuery<ActivityResponse>({
    queryKey: ['user-activity', userId, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.action)    params.set('action',    filters.action);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate)   params.set('endDate',   filters.endDate);
      const res = await api.get<{ data: ActivityResponse }>(
        `/users/${userId}/activity?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function useServerLoad() {
  return useQuery({
    queryKey: ['server-load'],
    queryFn: async () => {
      const res = await api.get<{ data: unknown[] }>('/servers/load');
      return res.data.data;
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useNotificationLogs(limit = 5) {
  return useQuery({
    queryKey: ['notification-logs', limit],
    queryFn: async () => {
      const res = await api.get<{ data: { items: unknown[] } }>(
        `/notifications/logs?limit=${limit}`,
      );
      return res.data.data.items ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
