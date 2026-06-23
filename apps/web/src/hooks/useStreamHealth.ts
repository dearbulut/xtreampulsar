import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface HealthLog {
  id: string;
  streamId: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface ChartPoint {
  time: string;
  uptime: number | null;
  responseTime: number | null;
}

export interface StreamHealthData {
  streamId: string;
  healthStatus: string;
  lastHealthCheck: string | null;
  lastError: string | null;
  uptimePercent: number;
  totalChecks: number;
  upCount: number;
  downCount: number;
  degradedCount: number;
  avgResponseTime: number | null;
  recentLogs: HealthLog[];
  chartData: ChartPoint[];
}

export function useStreamHealth(streamId: string | null, hours = 24) {
  return useQuery({
    queryKey: ['stream-health', streamId, hours],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: StreamHealthData }>(
        `/streams/${streamId!}/health?hours=${hours}`,
      );
      return res.data.data;
    },
    enabled: !!streamId,
    refetchInterval: 30_000,
  });
}

export function useManualHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (streamId: string) => {
      const res = await api.post<{ success: boolean; data: { status: string; responseTime: number | null } }>(
        `/streams/${streamId}/health/check`,
      );
      return res.data.data;
    },
    onSuccess: (data, streamId) => {
      const label = data.status === 'up' ? '✓ Çevrimiçi' : data.status === 'degraded' ? '⚠ Yavaş' : '✗ Erişilemiyor';
      toast.success(`Kontrol tamamlandı: ${label}`);
      void qc.invalidateQueries({ queryKey: ['stream-health', streamId] });
      void qc.invalidateQueries({ queryKey: ['streams'] });
    },
    onError: () => toast.error('Sağlık kontrolü başarısız'),
  });
}
