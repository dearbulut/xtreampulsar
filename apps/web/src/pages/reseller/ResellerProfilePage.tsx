import { useState, useEffect, useRef } from 'react';
import { User, Lock, Bell, BarChart2, Loader2, CheckCircle, Palette, Upload, X } from 'lucide-react';
import {
  useResellerMe,
  useResellerStats,
  useResellerUpdateProfile,
  useResellerChangePassword,
  useUpdateResellerBranding,
  useUploadBrandingLogo,
} from '@/hooks/useResellerPanel';
import { cn } from '@/lib/utils';

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Profile section ─────────────────────────────────────────────────────────

function ProfileSection() {
  const { data: me, isLoading } = useResellerMe();
  const updateProfile = useResellerUpdateProfile();
  const [email, setEmail] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (me) { setEmail(me.email ?? ''); setDirty(false); }
  }, [me]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({ email: email.trim() || undefined });
    setDirty(false);
  };

  if (isLoading) return <div className="text-sm text-muted py-2">Yükleniyor…</div>;

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Kullanıcı Adı</label>
        <input
          value={me?.username ?? ''}
          readOnly
          className="input w-full opacity-60 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">E-posta</label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
          placeholder="ornek@email.com"
          className="input w-full"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!dirty || updateProfile.isPending}
          className="btn btn-primary text-sm"
        >
          {updateProfile.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kaydediliyor…</>
          ) : (
            'Kaydet'
          )}
        </button>
        {!dirty && !updateProfile.isPending && updateProfile.isSuccess && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle className="w-3 h-3" /> Kaydedildi
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const changePassword = useResellerChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const mismatch = next.length > 0 && confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 6;
  const canSubmit = current.length > 0 && next.length >= 6 && next === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
    setCurrent(''); setNext(''); setConfirm('');
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Mevcut Şifre</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
          className="input w-full"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Yeni Şifre</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="En az 6 karakter"
          className={cn('input w-full', tooShort && 'border-danger/50')}
        />
        {tooShort && <p className="text-xs text-danger mt-1">En az 6 karakter olmalı</p>}
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">Yeni Şifre (Tekrar)</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className={cn('input w-full', mismatch && 'border-danger/50')}
        />
        {mismatch && <p className="text-xs text-danger mt-1">Şifreler eşleşmiyor</p>}
      </div>
      <button
        type="submit"
        disabled={!canSubmit || changePassword.isPending}
        className="btn btn-primary text-sm"
      >
        {changePassword.isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Değiştiriliyor…</>
        ) : (
          'Şifreyi Değiştir'
        )}
      </button>
    </form>
  );
}

// ─── Notifications section (UI only) ─────────────────────────────────────────

function NotificationsSection() {
  const [lowCredit, setLowCredit] = useState(true);
  const [expiring, setExpiring] = useState(true);

  return (
    <div className="space-y-3">
      {[
        { label: 'Düşük kredi uyarısı', desc: 'Krediniz 5\'in altına düştüğünde bildirim al', value: lowCredit, set: setLowCredit },
        { label: 'Kullanıcı süresi dolacak uyarısı', desc: '7 gün içinde süresi dolacak kullanıcılar için bildirim al', value: expiring, set: setExpiring },
      ].map(({ label, desc, value, set }) => (
        <label key={label} className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => set(e.target.checked)}
              className="sr-only"
            />
            <div
              onClick={() => set(!value)}
              className={cn(
                'w-9 h-5 rounded-full transition-colors flex items-center',
                value ? 'bg-primary' : 'bg-surface-2 border border-border',
              )}
            >
              {/* thumb: use --color-primary-fg when active so it stays visible
                  on light brand colours (e.g. yellow primary needs dark thumb) */}
              <div
                className={cn(
                  'w-3.5 h-3.5 rounded-full shadow transition-transform mx-0.5',
                  value ? 'translate-x-4' : 'translate-x-0',
                )}
                style={{ backgroundColor: value ? 'var(--color-primary-fg)' : '#ffffff' }}
              />
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">{label}</div>
            <div className="text-xs text-muted">{desc}</div>
          </div>
        </label>
      ))}
      <p className="text-[11px] text-muted/60 mt-2">Bildirim tercihleri kaydedilir (yakında e-posta entegrasyonu)</p>
    </div>
  );
}

// ─── Account summary section ─────────────────────────────────────────────────

function AccountSummarySection() {
  const { data: me } = useResellerMe();
  const { data: stats } = useResellerStats();

  const TIER_COLORS: Record<string, string> = {
    BASIC: 'text-slate-400 bg-slate-400/10',
    SILVER: 'text-slate-300 bg-slate-400/15',
    GOLD: 'text-amber-400 bg-amber-400/10',
    PLATINUM: 'text-cyan-400 bg-cyan-400/10',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-slate-200">{stats?.totalUsers ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">Toplam Kullanıcı</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-success">{stats?.activeUsers ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">Aktif Kullanıcı</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-slate-200">{stats?.onlineConnections ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">Anlık Bağlantı</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-warning">{stats?.expiredUsers ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">Süresi Dolmuş</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-muted">Üyelik Tarihi</span>
          <span className="text-slate-300">
            {me?.createdAt ? new Date(me.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted">Seviye</span>
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', TIER_COLORS[me?.tier ?? 'BASIC'] ?? 'text-muted')}>
            {me?.tier ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Branding section ─────────────────────────────────────────────────────────

function BrandingSection() {
  const { data: me } = useResellerMe();
  const updateBranding = useUpdateResellerBranding();
  const uploadLogo = useUploadBrandingLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (me) {
      setBrandName(me.brandName ?? '');
      setPrimaryColor(me.primaryColor ?? '');
      setPreviewLogo(me.logoUrl ?? null);
    }
  }, [me]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBranding.mutateAsync({ brandName, primaryColor });
  };

  const processFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewLogo(ev.target?.result as string);
    reader.readAsDataURL(file);
    uploadLogo.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Logo upload */}
      <div>
        <label className="text-xs font-medium text-muted block mb-2">Logo</label>
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-xl border border-border bg-surface-2 flex items-center justify-center overflow-hidden">
              {previewLogo ? (
                <img src={previewLogo} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl text-muted/30">?</span>
              )}
            </div>
            {previewLogo && (
              <button
                onClick={() => { setPreviewLogo(null); updateBranding.mutate({ brandName, primaryColor }); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center hover:bg-danger/80 transition-colors"
                title="Logo kaldır"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              'flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors min-h-[80px]',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />
            {uploadLogo.isPending ? (
              <Loader2 className="w-5 h-5 text-muted animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-muted" />
            )}
            <div className="text-center">
              <p className="text-xs text-slate-300">PNG, JPEG veya WebP</p>
              <p className="text-[11px] text-muted">Maks. 2 MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand name + color */}
      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">Marka Adı</label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Bayi Paneli"
            className="input w-full"
          />
          <p className="text-[11px] text-muted mt-1">Boş bırakılırsa "Bayi Paneli" gösterilir</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted block mb-1">Ana Renk</label>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={primaryColor || '#6366f1'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-surface-2"
              />
            </div>
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#6366f1"
              className="input flex-1 font-mono"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
            {primaryColor && (
              <div
                className="w-8 h-8 rounded-lg border border-border flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </div>
          <p className="text-[11px] text-muted mt-1">Butonlar ve aktif menü rengi. Boş bırakılırsa sistem rengi kullanılır.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={updateBranding.isPending}
            className="btn btn-primary text-sm"
          >
            {updateBranding.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kaydediliyor…</>
            ) : (
              'Kaydet'
            )}
          </button>
          {!updateBranding.isPending && updateBranding.isSuccess && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="w-3 h-3" /> Kaydedildi
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ResellerProfilePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Profil & Ayarlar</h1>
        <p className="text-sm text-muted">Hesap bilgilerinizi ve tercihlerinizi yönetin</p>
      </div>

      <Section title="Profil Bilgileri" icon={User}>
        <ProfileSection />
      </Section>

      <Section title="Şifre Değiştir" icon={Lock}>
        <PasswordSection />
      </Section>

      <Section title="Marka Ayarları" icon={Palette}>
        <BrandingSection />
      </Section>

      <Section title="Bildirim Tercihleri" icon={Bell}>
        <NotificationsSection />
      </Section>

      <Section title="Hesap Özeti" icon={BarChart2}>
        <AccountSummarySection />
      </Section>
    </div>
  );
}
