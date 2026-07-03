import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from '@tanstack/react-router';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

interface SetupData {
  secret: string;
  qrCodeUrl: string;
  qrCodeImage: string;
}

export function TwoFactorSetupPage() {
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem('2fa_setup_token');
    if (!token) {
      void router.navigate({ to: '/login' });
      return;
    }
    setSetupToken(token);
    api.get<{ success: boolean; data: SetupData }>(`/auth/2fa/forced-setup?setupToken=${encodeURIComponent(token)}`)
      .then((res) => setSetupData(res.data.data))
      .catch(() => {
        toast.error('2FA kurulum token\'ı geçersiz veya süresi dolmuş. Tekrar giriş yapın.');
        sessionStorage.removeItem('2fa_setup_token');
        void router.navigate({ to: '/login' });
      })
      .finally(() => setFetching(false));
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!setupToken || code.length !== 6) {
      toast.error('6 haneli kodu girin');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        data: { accessToken: string; refreshToken: string; user: { id: string; username: string; role: string } };
      }>('/auth/2fa/forced-setup', { setupToken, code });

      const { accessToken, refreshToken, user } = res.data.data;
      sessionStorage.removeItem('2fa_setup_token');
      useAuthStore.getState().setTokens(accessToken, refreshToken, {
        id: user.id,
        username: user.username,
        role: user.role as 'ADMIN' | 'RESELLER' | 'USER',
      });
      toast.success('2FA başarıyla etkinleştirildi');
      await router.navigate({ to: '/dashboard' });
    } catch {
      toast.error('Geçersiz doğrulama kodu');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">2FA Kurulumu Zorunlu</h1>
          <p className="text-muted text-sm">Yöneticiniz hesabınız için iki faktörlü doğrulamayı zorunlu kılmıştır.</p>
        </div>

        <div className="card p-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">1. Authenticator uygulamanızı açın ve QR kodu tarayın:</p>
            {setupData?.qrCodeImage && (
              <div className="flex justify-center">
                <img
                  src={setupData.qrCodeImage}
                  alt="2FA QR Kodu"
                  className="w-48 h-48 rounded-xl border-2 border-border bg-white p-2"
                />
              </div>
            )}
            {setupData?.secret && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted mb-1">Manuel giriş için gizli anahtar:</p>
                <code className="text-xs font-mono bg-surface-2 px-2 py-1 rounded text-primary break-all">
                  {setupData.secret}
                </code>
              </div>
            )}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="label flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                2. Uygulamadaki 6 haneli kodu girin:
              </label>
              <input
                type="text"
                className="input text-center text-xl tracking-widest"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Doğrulanıyor…
                </>
              ) : (
                '2FA\'yı Etkinleştir ve Giriş Yap'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
