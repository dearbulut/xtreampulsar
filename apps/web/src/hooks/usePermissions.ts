import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

export interface MyPermissions {
  isAdmin: boolean;
  isReseller: boolean;
  isBanned: boolean;
  permissions: string[];
}

/**
 * Roadmap D-2 — oturumdaki kullanicinin etkin izinleri.
 * Yuklenene kadar / hata halinde `can()` izin VERIR (menuyu/butonu gizlemez),
 * yani gizleme yalnizca kesin olarak izin YOKKEN yapilir.
 */
export function useMyPermissions() {
  const { data } = useQuery({
    queryKey: ['rbac', 'me'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: MyPermissions }>('/rbac/me');
      return res.data.data;
    },
    staleTime: 60_000,
    retry: false,
  });

  const can = (key?: string): boolean => {
    if (!key) return true;
    if (!data) return true;         // henuz bilinmiyor -> gizleme
    if (data.isAdmin) return true;  // tam yetki
    return data.permissions.includes(key);
  };

  return {
    can,
    isAdmin: data?.isAdmin ?? true,
    isReseller: data?.isReseller ?? false,
    loaded: !!data,
  };
}
