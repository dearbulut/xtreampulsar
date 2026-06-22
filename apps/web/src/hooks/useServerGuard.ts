import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface ServerGuard {
  id: string;
  serverId: string;
  enabled: boolean;
  sensitivePorts: number[];
  whitelistIps: string[];
  openPorts: number[];
  maxConnsPerIp: number;
  maxHitsNormalUser: number;
  maxHitsRestreamer: number;
  whitelistUsernames: string[];
  blockDurationMinutes: number;
  denyInvalidStreamIds: boolean;
  blockVpnProxy: boolean;
}

export interface BlockedIp {
  id: string;
  serverId: string;
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt: string;
}

export function useServerGuard(serverId: string | null) {
  return useQuery({
    queryKey: ['servers', serverId, 'guard'],
    queryFn: async () => {
      const res = await api.get<{ data: ServerGuard }>(`/servers/${serverId!}/guard`);
      return res.data.data;
    },
    enabled: !!serverId,
  });
}

export function useUpdateServerGuard(serverId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ServerGuard>) =>
      api.put<{ data: ServerGuard }>(`/servers/${serverId!}/guard`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servers', serverId, 'guard'] });
      toast.success('Guard ayarları kaydedildi');
    },
    onError: () => toast.error('Kaydetme başarısız'),
  });
}

export function useBlockedIps(serverId: string | null) {
  return useQuery({
    queryKey: ['servers', serverId, 'blocked-ips'],
    queryFn: async () => {
      const res = await api.get<{ data: BlockedIp[] }>(`/servers/${serverId!}/guard/blocked-ips`);
      return res.data.data;
    },
    enabled: !!serverId,
  });
}

export function useUnblockIp(serverId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ip: string) =>
      api.post(`/servers/${serverId!}/guard/unblock`, { ip }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servers', serverId, 'blocked-ips'] });
      toast.success('IP engeli kaldırıldı');
    },
  });
}
