import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

// Security endpoints are not yet implemented in the backend.
// These hooks use mock data for demo and will be wired to real endpoints when available.

export interface BlockedIP {
  id: string;
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  country?: string;
}

export interface BruteForceLog {
  id: string;
  ip: string;
  attempts: number;
  lastAttempt: string;
  blocked: boolean;
}

const MOCK_BLOCKS: BlockedIP[] = [
  { id: '1', ip: '192.168.1.100', reason: 'Too many failed login attempts', blockedAt: new Date().toISOString(), country: 'TR' },
  { id: '2', ip: '10.0.0.55', reason: 'VPN/Proxy detected', blockedAt: new Date(Date.now() - 60000).toISOString(), country: 'US' },
];

const MOCK_BF: BruteForceLog[] = [
  { id: '1', ip: '185.22.1.1', attempts: 47, lastAttempt: new Date().toISOString(), blocked: true },
  { id: '2', ip: '91.100.2.5', attempts: 12, lastAttempt: new Date(Date.now() - 300000).toISOString(), blocked: false },
];

export function useBlockedIPs() {
  return useQuery({
    queryKey: ['security', 'blocks'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; data: BlockedIP[] }>('/security/blocks');
        return res.data.data;
      } catch {
        // Return mock data until backend is ready
        return MOCK_BLOCKS;
      }
    },
    refetchInterval: 10_000,
  });
}

export function useBruteForceLogs() {
  return useQuery({
    queryKey: ['security', 'bruteforce'],
    queryFn: async () => {
      try {
        const res = await api.get<{ success: boolean; data: BruteForceLog[] }>('/security/bruteforce');
        return res.data.data;
      } catch {
        return MOCK_BF;
      }
    },
  });
}

export function useUnblockIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ip: string) => api.delete(`/security/blocks/${encodeURIComponent(ip)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security'] });
      toast.success('IP engeli kaldırıldı');
    },
    onError: () => toast.error('İşlem başarısız'),
  });
}

export function useBlockIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ip: string; reason: string; durationMinutes?: number }) =>
      api.post('/security/blocks', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security'] });
      toast.success('IP engellendi');
    },
    onError: () => toast.error('Engelleme başarısız'),
  });
}
