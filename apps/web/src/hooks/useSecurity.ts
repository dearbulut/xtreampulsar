import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

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

export function useBlockedIPs() {
  return useQuery({
    queryKey: ['security', 'blocks'],
    queryFn: async () => {
      // GET /security/blocked-ips → { success, data: { items, total, page, totalPages } }
      const res = await api.get<{ success: boolean; data: { items: BlockedIP[] } }>('/security/blocked-ips');
      const body = res.data?.data ?? res.data;
      const items = (body as { items?: BlockedIP[] })?.items ?? body;
      return Array.isArray(items) ? items : [];
    },
    refetchInterval: 10_000,
  });
}

// Backend'de brute-force takip endpoint'i YOK. Sahte veri göstermek yerine boş
// liste döndürüyoruz; UI "veri yok" durumunu gösterir. Endpoint eklenince
// buraya gerçek çağrı bağlanacak.
export function useBruteForceLogs() {
  return useQuery({
    queryKey: ['security', 'bruteforce'],
    queryFn: async (): Promise<BruteForceLog[]> => [],
  });
}

export function useUnblockIP() {
  const qc = useQueryClient();
  return useMutation({
    // DELETE /security/unban/:ip (204 No Content)
    mutationFn: (ip: string) => api.delete(`/security/unban/${encodeURIComponent(ip)}`),
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
    // POST /security/ban  body: { ip, reason, durationMinutes? }
    mutationFn: (data: { ip: string; reason: string; durationMinutes?: number }) =>
      api.post('/security/ban', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security'] });
      toast.success('IP engellendi');
    },
    onError: () => toast.error('Engelleme başarısız'),
  });
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  actorType?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AuditLogFilter {
  page?: number;
  limit?: number;
  adminId?: string;
  resource?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useAuditLogs(filter: AuditLogFilter = {}) {
  const params = new URLSearchParams();
  if (filter.page) params.set('page', String(filter.page));
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.adminId) params.set('adminId', filter.adminId);
  if (filter.resource) params.set('resource', filter.resource);
  if (filter.action) params.set('action', filter.action);
  if (filter.dateFrom) params.set('dateFrom', filter.dateFrom);
  if (filter.dateTo) params.set('dateTo', filter.dateTo);

  return useQuery({
    queryKey: ['audit', 'logs', filter],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AuditLogsResponse }>(`/audit/logs?${params.toString()}`);
      return res.data.data;
    },
    placeholderData: (prev) => prev,
  });
}

// ─── Blocked connection attempts (anti-abuse görünürlüğü) ────────────────────
export interface BlockedAttempt {
  id: string;
  userId: string | null;
  username: string | null;
  ip: string | null;
  country: string | null;
  reason: string;
  category: string;
  userAgent: string | null;
  createdAt: string;
}

export interface BlockedAttemptsResponse {
  items: BlockedAttempt[];
  total: number;
  page: number;
  limit: number;
  last24h: number;
  categories: Record<string, number>;
}

export function useBlockedAttempts(category?: string) {
  return useQuery({
    queryKey: ['security', 'blocked-attempts', category ?? 'all'],
    queryFn: async () => {
      const q = category ? `?category=${category}` : '';
      const res = await api.get<{ success: boolean; data: BlockedAttemptsResponse }>(`/security/blocked-attempts${q}`);
      return res.data.data;
    },
    refetchInterval: 30_000,
  });
}
