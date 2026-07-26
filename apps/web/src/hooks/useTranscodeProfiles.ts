import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

export interface AbrVariant {
  name?: string;
  width?: number;
  height?: number;
  videoBitrate?: number;
  maxBitrate?: number;
  audioBitrate?: number;
}

export interface TranscodeProfile {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;

  videoCodec: string;
  videoPreset?: string | null;
  videoBitrate?: number | null;
  maxBitrate?: number | null;
  bufSize?: number | null;
  crf?: number | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  gopSize?: number | null;
  pixFmt?: string | null;
  videoProfile?: string | null;
  videoTune?: string | null;

  audioCodec: string;
  audioBitrate?: number | null;
  audioChannels?: number | null;
  audioRate?: number | null;

  hlsSegmentSec: number;
  hlsListSize: number;
  hlsDeleteSegments: boolean;

  abrEnabled: boolean;
  abrVariants?: AbrVariant[] | null;

  hwAccel?: string | null;
  threads?: number | null;
  extraArgs?: string | null;

  createdAt: string;
  updatedAt: string;
  _count?: { streams: number };
}

export interface TranscodeProfileOption {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  abrEnabled: boolean;
  videoCodec: string;
  height?: number | null;
}

export interface TranscodeCodecs {
  videoCodecs: string[];
  audioCodecs: string[];
  hwAccels: string[];
  presets: string[];
}

export interface TranscodePreview {
  profileId: string;
  profileName: string;
  streamId: string | null;
  streamName: string | null;
  inputUrl: string;
  outputDir: string;
  variantDirs: string[];
  args: string[];
  command: string;
}

const KEY = ['transcode-profiles'];

export function useTranscodeProfiles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TranscodeProfile[] }>(
        '/transcode-profiles',
      );
      return res.data.data;
    },
  });
}

/** Akis formundaki select icin hafif liste. */
export function useTranscodeProfileOptions() {
  return useQuery({
    queryKey: [...KEY, 'options'],
    queryFn: async () => {
      const res = await api.get<{
        success: boolean;
        data: TranscodeProfileOption[];
      }>('/transcode-profiles/options');
      return res.data.data;
    },
    staleTime: 300_000,
  });
}

export function useTranscodeCodecs() {
  return useQuery({
    queryKey: [...KEY, 'codecs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: TranscodeCodecs }>(
        '/transcode-profiles/codecs',
      );
      return res.data.data;
    },
    staleTime: Infinity,
  });
}

export function useCreateTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TranscodeProfile>) =>
      api.post('/transcode-profiles', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Profil olusturuldu');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Olusturma basarisiz'),
  });
}

export function useUpdateTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TranscodeProfile> }) =>
      api.patch(`/transcode-profiles/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Profil guncellendi');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Guncelleme basarisiz'),
  });
}

export function useDeleteTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transcode-profiles/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Profil silindi');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Silme basarisiz'),
  });
}

export function useCloneTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/transcode-profiles/${id}/clone`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Profil kopyalandi');
    },
    onError: () => toast.error('Kopyalama basarisiz'),
  });
}

export function useSetDefaultTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/transcode-profiles/${id}/default`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Varsayilan profil ayarlandi');
    },
    onError: () => toast.error('Islem basarisiz'),
  });
}

export function usePreviewTranscodeProfile() {
  return useMutation({
    mutationFn: async ({
      id,
      inputUrl,
      streamId,
    }: {
      id: string;
      inputUrl?: string;
      streamId?: string;
    }) => {
      const res = await api.post<{ success: boolean; data: TranscodePreview }>(
        `/transcode-profiles/${id}/preview`,
        { inputUrl, streamId },
      );
      return res.data.data;
    },
    onError: () => toast.error('Onizleme alinamadi'),
  });
}

export function useAssignTranscodeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { streamIds: string[]; profileId: string | null }) =>
      api.post('/transcode-profiles/assign', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['streams'] });
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success('Profil atandi');
    },
    onError: () => toast.error('Atama basarisiz'),
  });
}
