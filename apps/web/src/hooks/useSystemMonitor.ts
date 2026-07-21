import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface MonitorStatus {
  cpu: number;
  mem: number;
  disk: number;
  rxMbps: number;
  txMbps: number;
  memTotalMb: number;
  memUsedMb: number;
  loadAvg: number[];
  cores: number;
  uptimeSecs: number;
}

export interface MonitorConfig {
  enabled: boolean;
  cpuAlertPct: number;
  memAlertPct: number;
  diskAlertPct: number;
  netAlertMbps: number;
}

export function useMonitorStatus() {
  return useQuery({
    queryKey: ['monitor', 'status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MonitorStatus }>('/monitor/status');
      return res.data.data;
    },
    refetchInterval: 5000,
  });
}

export function useMonitorConfig() {
  return useQuery({
    queryKey: ['monitor', 'config'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MonitorConfig }>('/monitor/config');
      return res.data.data;
    },
  });
}

export function useUpdateMonitorConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<MonitorConfig>) => {
      const res = await api.patch<{ success: boolean; data: MonitorConfig }>('/monitor/config', body);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor', 'config'] }),
  });
}

export function useRunMonitorCheck() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { status: MonitorStatus; alerted: string[] } }>('/monitor/check', {});
      return res.data.data;
    },
  });
}
