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
  redisConnected: boolean;
  uptime: number;
  uptimeFormatted: string;
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


// ─── IPTV Checker ────────────────────────────────────────────────────────────

export interface IptvCheckResult {
  ok: boolean;
  error?: string;
  auth?: boolean;
  status?: string;
  isTrial?: boolean;
  expDate?: string | null;
  createdAt?: string | null;
  activeCons?: number | null;
  maxConnections?: number | null;
  serverUrl?: string | null;
  serverPort?: string | null;
  httpsPort?: string | null;
  timezone?: string | null;
}

export function useIptvCheck() {
  return useMutation({
    mutationFn: async (data: { host: string; username: string; password: string }) => {
      const res = await api.post<{ success: boolean; data: IptvCheckResult }>('/tools/iptv-check', data);
      return res.data.data;
    },
  });
}


// ─── Fix Stream Types ────────────────────────────────────────────────────────

export interface FixStreamTypesResult {
  checked: number;
  changed: number;
  details: Array<{ id: string; name: string; oldType: string; newType: string }>;
}

export function useFixStreamTypes() {
  return useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await api.post<{ success: boolean; data: FixStreamTypesResult }>(
        '/migration/fix-stream-types',
        { dryRun },
      );
      return res.data.data;
    },
  });
}


// ─── Regroup Series (dizi bölümlerini tek dizi altında topla) ────────────────

export interface RegroupSeriesResult {
  scanned: number;
  seriesGroups: number;
  parentsToCreate: number;
  episodesToCreate: number;
  streamsToRemove: number;
  details: Array<{ title: string; category: string; episodes: number }>;
}

export function useRegroupSeries() {
  return useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await api.post<{ success: boolean; data: RegroupSeriesResult }>(
        '/migration/regroup-series',
        { dryRun },
        { timeout: 180_000 }, // 89k+ stream taraması global 30s sınırını aşabilir
      );
      return res.data.data;
    },
  });
}
