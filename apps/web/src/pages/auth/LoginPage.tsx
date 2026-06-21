import { useState, type FormEvent } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Zap, Shield, Tv, Users, Activity, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: Tv, text: 'Sınırsız stream yönetimi' },
  { icon: Users, text: 'Kullanıcı ve reseller sistemi' },
  { icon: Activity, text: 'Gerçek zamanlı analitik' },
  { icon: Shield, text: 'Güvenli JWT kimlik doğrulama' },
];

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Kullanıcı adı ve şifre gerekli');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      await router.navigate({ to: '/dashboard' });
      toast.success('Giriş başarılı');
    } catch {
      toast.error('Geçersiz kullanıcı adı veya şifre');
    } finally {
      setLoading(false);
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
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-bold text-xl text-gradient">XtreamPulsar</div>
              <div className="text-xs text-muted">IPTV Middleware</div>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-100 leading-tight mb-4">
            Profesyonel IPTV<br />
            <span className="text-gradient">Yönetim Paneli</span>
          </h1>
          <p className="text-muted text-lg mb-10">
            Stream'lerinizi, kullanıcılarınızı ve içeriklerinizi tek bir yerden yönetin.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-muted">
          © 2024 XtreamPulsar. Tüm hakları saklıdır.
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10 justify-center">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gradient">XtreamPulsar</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-100 mb-1">Hoş geldiniz</h2>
            <p className="text-muted text-sm">Devam etmek için giriş yapın</p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
              <label className="label">Kullanıcı Adı</label>
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
              <label className="label">Şifre</label>
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
                  Giriş yapılıyor…
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          <div className="mt-8 p-4 rounded-xl bg-surface border border-border">
            <p className="text-xs text-muted text-center">
              XtreamPulsar Admin Panel v1.0 •{' '}
              <span className="text-primary">API v1</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
