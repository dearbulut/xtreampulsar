import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export type MigrationSource = 'XTREAMUI' | 'XUIONE' | 'M3U' | 'XTREAM_API';
export type MigrationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface MigrationJob {
  id: string;
  source: MigrationSource;
  status: MigrationStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors?: unknown;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DumpPreview {
  source: 'XTREAMUI' | 'XUIONE' | 'UNKNOWN';
  streams: { total: number; live: number; vod: number; series: number };
  categories: { total: number; live: number; vod: number; series: number };
  users: { total: number };
  resellers: { total: number };
  packages: { total: number };
  bouquets: { total: number };
  epgMappings: { total: number };
}

export interface DumpImportOptions {
  importStreams: boolean;
  importCategories: boolean;
  importUsers: boolean;
  importResellers: boolean;
  importPackages: boolean;
  importBouquets: boolean;
  importEpgMappings: boolean;
  conflictMode: 'SKIP' | 'OVERWRITE' | 'MERGE';
  defaultPassword?: string;
}

// ─── Job queries ──────────────────────────────────────────────────────────────

export function useMigrationJobs() {
  return useQuery({
    queryKey: ['migration', 'jobs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MigrationJob[] }>('/migration/jobs');
      return res.data.data;
    },
  });
}

export function useMigrationJob(id: string | null, active = false) {
  return useQuery({
    queryKey: ['migration', 'jobs', id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MigrationJob }>(`/migration/jobs/${id!}`);
      return res.data.data;
    },
    enabled: !!id && active,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === 'RUNNING' || data.status === 'PENDING' ? 2_000 : false;
    },
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/migration/jobs/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['migration'] });
      toast.success('İptal edildi');
    },
    onError: () => toast.error('İptal başarısız'),
  });
}

// ─── SQL Dump flow ────────────────────────────────────────────────────────────

export function useUploadDump() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<{ success: boolean; data: { jobId: string } }>(
        '/migration/upload',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['migration'] }),
    onError: () => toast.error('Yükleme başarısız'),
  });
}

export function usePreviewDump() {
  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<{ success: boolean; data: DumpPreview }>(`/migration/preview/${jobId}`),
    onError: () => toast.error('Analiz başarısız'),
  });
}

export function useStartDumpImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, options }: { jobId: string; options: DumpImportOptions }) =>
      api.post<{ success: boolean; data: { jobId: string } }>(`/migration/import/${jobId}`, options),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['migration'] });
      toast.success('Import başlatıldı');
    },
    onError: () => toast.error('Import başarısız'),
  });
}

// ─── M3U flow ─────────────────────────────────────────────────────────────────

export function usePreviewM3U() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<{ success: boolean; data: { entries: { name: string; url: string; groupTitle: string }[]; total: number } }>(
        '/migration/m3u/preview',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    },
  });
}

export function useImportM3U() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, dryRun, conflictMode }: { file: File; dryRun?: boolean; conflictMode?: 'SKIP' | 'OVERWRITE' | 'MERGE' }) => {
      const form = new FormData();
      form.append('file', file);
      if (dryRun !== undefined) form.append('dryRun', String(dryRun));
      if (conflictMode) form.append('conflictMode', conflictMode);
      return api.post<{ success: boolean; data: { jobId: string } }>(
        '/migration/m3u/import',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['migration'] });
      toast.success('Import başlatıldı');
    },
    onError: () => toast.error('Import başarısız'),
  });
}

export function useImportXtream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      serverUrl: string;
      username: string;
      password: string;
      importLive?: boolean;
      importVod?: boolean;
      importSeries?: boolean;
      dryRun?: boolean;
    }) => api.post<{ success: boolean; data: { jobId: string } }>('/migration/xtream/import', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['migration'] });
      toast.success('Xtream import başlatıldı');
    },
    onError: () => toast.error('Import başarısız'),
  });
}
