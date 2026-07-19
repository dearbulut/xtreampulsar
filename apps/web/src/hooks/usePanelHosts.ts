import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface PanelHosts {
  resellerPanelHost: string;
  clientPanelHost: string;
}

export function usePanelHosts() {
  return useQuery({
    queryKey: ['panel-hosts'],
    queryFn: async (): Promise<PanelHosts> => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>('/settings');
      const d = res.data.data ?? {};
      return {
        resellerPanelHost: (d.resellerPanelHost as string) ?? '',
        clientPanelHost: (d.clientPanelHost as string) ?? '',
      };
    },
  });
}

export function useSavePanelHosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PanelHosts>) => api.patch('/settings', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['panel-hosts'] });
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
