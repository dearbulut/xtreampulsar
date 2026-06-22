import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import type { DashboardData, BandwidthPoint, Server } from '@/types';

export function useDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardData }>('/analytics/dashboard');
      return res.data.data;
    },
    refetchInterval: 5_000,
  });
}

export function useBandwidth() {
  return useQuery({
    queryKey: ['analytics', 'bandwidth'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: BandwidthPoint[] }>('/analytics/bandwidth');
      return res.data.data;
    },
    refetchInterval: 10_000,
  });
}

export function useServerStats() {
  return useQuery({
    queryKey: ['analytics', 'servers'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Server[] }>('/analytics/servers');
      return res.data.data;
    },
    refetchInterval: 5_000,
  });
}

export function useTopStreams(limit = 5) {
  return useQuery({
    queryKey: ['analytics', 'top-streams', limit],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { stream: { id: string; name: string }; connections: number }[] }>(
        `/analytics/top-streams?limit=${limit}`,
      );
      return res.data.data;
    },
    refetchInterval: 15_000,
  });
}

export interface GeoEntry {
  countryCode: string;
  country: string;
  count: number;
}

export function useGeoConnections() {
  return useQuery<GeoEntry[]>({
    queryKey: ['analytics', 'geo-connections'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: GeoEntry[] }>('/analytics/geo-connections');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}
