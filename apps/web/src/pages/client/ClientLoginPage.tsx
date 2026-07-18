import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Tv2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export function ClientLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clientLogin = useAuthStore((s) => s.clientLogin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await clientLogin(username, password);
      void navigate({ to: '/client/dashboard' });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Tv2 className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-100">{t('auth.clientTitle')}</h1>
            <p className="text-sm text-muted mt-1">{t('auth.clientSubtitle')}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="card p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              className="input w-full"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">{t('auth.password')}</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="input w-full pr-10"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  );
}
