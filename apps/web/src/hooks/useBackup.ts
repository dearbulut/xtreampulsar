import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export function useBackupList() {
  return useQuery({
    queryKey: ['backup-list'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: BackupFile[] }>('/backup/list');
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ success: boolean; data: BackupFile }>('/backup/create'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['backup-list'] });
      toast.success('Yedek oluşturuldu');
    },
    onError: () => toast.error('Yedek oluşturma başarısız'),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => api.delete(`/backup/${encodeURIComponent(filename)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['backup-list'] });
      toast.success('Yedek silindi');
    },
    onError: () => toast.error('Silme başarısız'),
  });
}

export function useDownloadBackup() {
  return async (filename: string) => {
    const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}

export function useUploadDropbox() {
  return useMutation({
    mutationFn: (filename: string) =>
      api.post(`/backup/upload-dropbox/${encodeURIComponent(filename)}`),
    onSuccess: () => toast.success("Dropbox'a yüklendi"),
    onError: () => toast.error("Dropbox yükleme başarısız"),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
