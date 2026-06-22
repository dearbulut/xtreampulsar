import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes: string;
  releaseUrl: string;
  publishedAt: string;
  checkedAt: string;
}

export function useUpdateCheck() {
  return useQuery<UpdateInfo>({
    queryKey: ['update-check'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: UpdateInfo }>('/update/check');
      return res.data.data;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useApplyUpdate() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: { started: boolean; message: string } }>('/update/apply');
      return res.data.data;
    },
  });
}
