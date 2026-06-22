import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

// ─── Fix Users Output ────────────────────────────────────────────────────────

interface FixUsersOutputResponse {
  fixed: number;
}

export function useFixUsersOutput() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: FixUsersOutputResponse }>(
        '/tools/fix-users-output',
      );
      return res.data.data;
    },
  });
}

// ─── Streams to JSON ─────────────────────────────────────────────────────────

interface StreamJson {
  id: string;
  name: string;
  url: string;
  type: string;
  category: string;
}

export function useStreamsToJson() {
  return useMutation({
    mutationFn: async (body: { streamType: string }) => {
      const res = await api.post<{ success: boolean; data: StreamJson[] }>(
        '/tools/streams-to-json',
        body,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'streams.json';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

// ─── Set Stream Server ───────────────────────────────────────────────────────

interface SetStreamServerResponse {
  updated: number;
}

export function useSetStreamServer() {
  return useMutation({
    mutationFn: async (body: { serverId: string; streamIds?: string[]; streamType: string }) => {
      const res = await api.post<{ success: boolean; data: SetStreamServerResponse }>(
        '/tools/set-stream-server',
        body,
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.updated} stream güncellendi`);
    },
  });
}

// ─── Clean Database ──────────────────────────────────────────────────────────

interface CleanDatabaseResponse {
  deleted: Record<string, number>;
}

export function useCleanDatabase() {
  return useMutation({
    mutationFn: async (body: { targets: string[] }) => {
      const res = await api.post<{ success: boolean; data: CleanDatabaseResponse }>(
        '/tools/clean-database',
        body,
      );
      return res.data.data;
    },
  });
}

// ─── Restart All Streams ─────────────────────────────────────────────────────

interface RestartAllStreamsResponse {
  restarted: number;
}

export function useRestartAllStreams() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: RestartAllStreamsResponse }>(
        '/tools/restart-all-streams',
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.restarted} worker yeniden başlatıldı`);
    },
  });
}

// ─── ReEncode VODs ───────────────────────────────────────────────────────────

interface ReencodeVodsResponse {
  queued: number;
}

export function useReencodeVods() {
  return useMutation({
    mutationFn: async (body: { categoryId?: string; serverId?: string; mode: string }) => {
      const res = await api.post<{ success: boolean; data: ReencodeVodsResponse }>(
        '/tools/reencode-vods',
        body,
      );
      return res.data.data;
    },
  });
}

// ─── Bulk Series Import ──────────────────────────────────────────────────────

interface BulkSeriesImportResponse {
  found: number;
  imported: number;
  logs: string[];
}

export function useBulkSeriesImport() {
  return useMutation({
    mutationFn: async (body: {
      categoryId: string;
      folderPath: string;
      specialCharEncoding: boolean;
    }) => {
      const res = await api.post<{ success: boolean; data: BulkSeriesImportResponse }>(
        '/tools/bulk-series-import',
        body,
      );
      return res.data.data;
    },
  });
}

// ─── System Stats ────────────────────────────────────────────────────────────

export interface SystemStats {
  cpuLoad: number;
  totalMemMb: number;
  freeMemMb: number;
  memUsedPct: number;
  runningWorkers: number;
  dbConnected: boolean;
  uptime: number;
}

export function useSystemStats() {
  return useQuery({
    queryKey: ['tools', 'system-stats'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SystemStats }>('/tools/system-stats');
      return res.data.data;
    },
    refetchInterval: 10_000,
  });
}
