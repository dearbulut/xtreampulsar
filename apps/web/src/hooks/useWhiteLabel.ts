import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

interface WhiteLabelConfig {
  id: string;
  panelName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customCss: string | null;
  footerText: string | null;
  supportEmail: string | null;
  supportUrl: string | null;
  isActive: boolean;
}

export function useWhiteLabel() {
  return useQuery<WhiteLabelConfig | null>({
    queryKey: ['white-label'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: WhiteLabelConfig | null }>('/white-label/config');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateWhiteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Partial<WhiteLabelConfig>) => {
      const res = await api.patch<{ success: boolean; data: WhiteLabelConfig }>('/white-label/config', dto);
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['white-label'] });
      toast.success('White-label ayarları kaydedildi');
    },
    onError: () => toast.error('Kayıt başarısız'),
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<{ success: boolean; data: WhiteLabelConfig }>('/white-label/upload-logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['white-label'] });
      toast.success('Logo yüklendi');
    },
    onError: () => toast.error('Logo yükleme başarısız'),
  });
}
