import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

/**
 * Sunucu salt-okunur demo modunda mi? (API tarafinda DEMO_MODE=true)
 * /settings/public auth istemez, sonuc onbelleklenir.
 */
export function useDemoMode(): boolean {
  const { data } = useQuery({
    queryKey: ['public-demo-mode'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data?: { demoMode?: boolean } }>('/settings/public');
        return res.data?.data?.demoMode === true;
      } catch {
        return false;
      }
    },
    staleTime: 10 * 60_000,
  });
  return data === true;
}
