import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface AiSettings {
  aiEnabled: boolean;
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
}

const DEFAULT_AI: AiSettings = {
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiApiKey: '',
  aiModel: '',
  aiSystemPrompt: '',
};

export function useAiSettings() {
  return useQuery({
    queryKey: ['ai-settings'],
    queryFn: async (): Promise<AiSettings> => {
      const res = await api.get<{ success: boolean; data: Record<string, unknown> }>('/settings');
      const d = res.data.data ?? {};
      return {
        aiEnabled: Boolean(d.aiEnabled),
        aiProvider: (d.aiProvider as string) || DEFAULT_AI.aiProvider,
        aiApiKey: (d.aiApiKey as string) ?? '',
        aiModel: (d.aiModel as string) ?? '',
        aiSystemPrompt: (d.aiSystemPrompt as string) ?? '',
      };
    },
  });
}

export function useSaveAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AiSettings>) => api.patch('/settings', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-settings'] });
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
