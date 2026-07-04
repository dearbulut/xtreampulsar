import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

interface SetupData {
  secret: string;
  qrCodeUrl: string;
  qrCodeImage: string;
}

// Reads the authoritative 2FA state from the server (/auth/me already returns
// twoFactorEnabled). Used so the settings UI reflects real state instead of a
// local guess — prevents offering "setup" to an already-enabled account.
export function use2FAStatus() {
  return useQuery<{ twoFactorEnabled: boolean }>({
    queryKey: ['2fa-status'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { twoFactorEnabled: boolean } }>('/auth/me');
      return { twoFactorEnabled: !!res.data.data.twoFactorEnabled };
    },
    staleTime: 0,
  });
}

export function use2FASetup(enabled: boolean) {
  return useQuery<SetupData>({
    queryKey: ['2fa-setup'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: SetupData }>('/auth/2fa/setup');
      return res.data.data;
    },
    enabled,
    staleTime: 0,
  });
}

export function use2FAEnable() {
  return useMutation({
    mutationFn: (code: string) => api.post('/auth/2fa/enable', { code }),
    onSuccess: () => toast.success('2FA etkinleştirildi'),
    onError: () => toast.error('Geçersiz doğrulama kodu'),
  });
}

export function use2FADisable() {
  return useMutation({
    mutationFn: (password: string) => api.post('/auth/2fa/disable', { password }),
    onSuccess: () => toast.success('2FA devre dışı bırakıldı'),
    onError: () => toast.error('Geçersiz şifre'),
  });
}

export function use2FAVerify() {
  return useMutation({
    mutationFn: ({ tempToken, code }: { tempToken: string; code: string }) =>
      api.post<{ success: boolean; data: { accessToken: string; refreshToken: string; user: { id: string; username: string; role: string } } }>(
        '/auth/2fa/verify',
        { tempToken, code },
      ),
    onError: () => toast.error('Geçersiz doğrulama kodu'),
  });
}
