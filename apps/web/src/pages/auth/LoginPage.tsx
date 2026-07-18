import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from '@tanstack/react-router';
import { Zap, Shield, Tv, Users, Activity, Eye, EyeOff, SmartphoneNfc } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { use2FAVerify } from '@/hooks/useTwoFactor';
import api from '@/lib/axios';
import toast from 'react-hot-toast';

interface PublicConfig {
  panelName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

const FEATURES = [
  { icon: Tv, key: 'auth.feature1' },
  { icon: Users, key: 'auth.feature2' },
  { icon: Activity, key: 'auth.feature3' },
  { icon: Shield, key: 'auth.feature4' },
];

export function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publicConfig, setPublicConfig] = useState<PublicConfig>({ panelName: 'XtreamPulsar', logoUrl: null, primaryColor: null });

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const router = useRouter();
  const verify2FA = use2FAVerify();

  useEffect(() => {
    void api.get<{ success: boolean; data: PublicConfig }>('/settings/public')
      .then((res) => {
        const cfg = res.data.data;
        setPublicConfig(cfg);
        if (cfg.primaryColor) {
          document.documentElement.style.setProperty('--color-primary', cfg.primaryColor);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error(t('auth.credentialsRequired'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        data: { require2FASetup?: boolean; setupToken?: string; requiresTwoFactor?: boolean; tempToken?: string; accessToken?: string; refreshToken?: string; user?: { id: string; username: string; role: string } };
      }>('/auth/login', { username, password });

      const data = res.data.data;

      if (data.require2FASetup && data.setupToken) {
        sessionStorage.setItem('2fa_setup_token', data.setupToken);
        await router.navigate({ to: '/setup-2fa' });
        return;
      }

      if (data.requiresTwoFactor && data.tempToken) {
        setTempToken(data.tempToken);
        setRequires2FA(true);
        return;
      }

      if (data.accessToken && data.refreshToken && data.user) {
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken, {
          id: data.user.id,
          username: data.user.username,
          role: data.user.role as 'ADMIN' | 'RESELLER' | 'USER',
        });
        await router.navigate({ to: '/dashboard' });
        toast.success(t('auth.loginSuccess'));
      }
    } catch {
      toast.error(t('auth.invalidUsernameOrPassword'));
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      toast.error(t('auth.enterCode6'));
      return;
    }
    try {
      const res = await verify2FA.mutateAsync({ tempToken, code: totpCode });
      const data = res.data.data;
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken, {
        id: data.user.id,
        username: data.user.username,
        role: data.user.role as 'ADMIN' | 'RESELLER' | 'USER',
      });
      await router.navigate({ to: '/dashboard' });
      toast.success(t('auth.loginSuccess'));
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 bg-gradient-to-br from-primary/20 via-purple-900/20 to-background relative overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
              {publicConfig.logoUrl
                ? <img src={publicConfig.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                : <Zap className="w-6 h-6 text-white" />}
            </div>
            <div>
              <div className="font-bold text-xl text-gradient">{publicConfig.panelName}</div>
              <div className="text-xs text-muted">{t('auth.middleware')}</div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-100 leading-tight mb-4">
            {t('auth.heroTitle1')}<br />
            <span className="text-gradient">{t('auth.heroTitle2')}</span>
          </h1>
          <p className="text-muted text-lg mb-10">
            {t('auth.heroSubtitle')}
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-slate-300 text-sm">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-muted">
          {t('auth.copyright')}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              {publicConfig.logoUrl
                ? <img src={publicConfig.logoUrl} alt="Logo" className="w-7 h-7 object-contain" />
                : <Zap className="w-5 h-5 text-white" />}
            </div>
            <span className="font-bold text-xl text-gradient">{publicConfig.panelName}</span>
          </div>

          {!requires2FA ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-100 mb-1">{t('auth.welcome')}</h2>
                <p className="text-muted text-sm">{t('auth.loginToContinue')}</p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                <div>
                  <label className="label">{t('auth.username')}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">{t('auth.password')}</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate-300 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('auth.loggingIn')}
                    </>
                  ) : (
                    t('auth.login')
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <SmartphoneNfc className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-1">{t('auth.twoFactorTitle')}</h2>
                <p className="text-muted text-sm">{t('auth.twoFactorSubtitle')}</p>
              </div>

              <form onSubmit={(e) => void handle2FASubmit(e)} className="space-y-5">
                <div>
                  <label className="label">{t('auth.verificationCode')}</label>
                  <input
                    type="text"
                    className="input text-center text-xl tracking-widest"
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="submit"
                  disabled={verify2FA.isPending}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                >
                  {verify2FA.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('auth.verifying')}
                    </>
                  ) : (
                    t('auth.verify')
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setRequires2FA(false); setTempToken(''); setTotpCode(''); }}
                  className="w-full text-center text-sm text-muted hover:text-slate-300 transition-colors"
                >
                  {t('auth.goBack')}
                </button>
              </form>
            </>
          )}

          <div className="mt-8 p-4 rounded-xl bg-surface border border-border">
            <p className="text-xs text-muted text-center">
              {publicConfig.panelName} {t('auth.adminPanelTag')}{' '}
              <span className="text-primary">API v1</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
