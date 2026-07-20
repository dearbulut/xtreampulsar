import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Lock, Bell, BarChart2, Loader2, CheckCircle, Palette, Upload, X, Gift, Copy } from 'lucide-react';
import {
  useResellerMe,
  useResellerStats,
  useResellerUpdateProfile,
  useResellerChangePassword,
  useUpdateResellerBranding,
  useUploadBrandingLogo,
  useResellerReferral,
} from '@/hooks/useResellerPanel';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';

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
  const { t } = useTranslation();
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

  if (isLoading) return <div className="text-sm text-muted py-2">{t('common.loading')}</div>;

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.username')}</label>
        <input
          value={me?.username ?? ''}
          readOnly
          className="input w-full opacity-60 cursor-not-allowed"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.email')}</label>
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
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('reseller.profile.saving')}</>
          ) : (
            t('common.save')
          )}
        </button>
        {!dirty && !updateProfile.isPending && updateProfile.isSuccess && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle className="w-3 h-3" /> {t('reseller.profile.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const { t } = useTranslation();
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
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.currentPassword')}</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
          className="input w-full"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.newPassword')}</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={t('reseller.profile.min6Placeholder')}
          className={cn('input w-full', tooShort && 'border-danger/50')}
        />
        {tooShort && <p className="text-xs text-danger mt-1">{t('reseller.profile.min6Error')}</p>}
      </div>
      <div>
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.newPasswordRepeat')}</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className={cn('input w-full', mismatch && 'border-danger/50')}
        />
        {mismatch && <p className="text-xs text-danger mt-1">{t('reseller.profile.passwordMismatch')}</p>}
      </div>
      <button
        type="submit"
        disabled={!canSubmit || changePassword.isPending}
        className="btn btn-primary text-sm"
      >
        {changePassword.isPending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('reseller.profile.changing')}</>
        ) : (
          t('reseller.profile.changePasswordBtn')
        )}
      </button>
    </form>
  );
}

// ─── Notifications section (UI only) ─────────────────────────────────────────

function NotificationsSection() {
  const { t } = useTranslation();
  const [lowCredit, setLowCredit] = useState(true);
  const [expiring, setExpiring] = useState(true);

  return (
    <div className="space-y-3">
      {[
        { label: t('reseller.profile.lowCreditLabel'), desc: t('reseller.profile.lowCreditDesc'), value: lowCredit, set: setLowCredit },
        { label: t('reseller.profile.expiringLabel'), desc: t('reseller.profile.expiringDesc'), value: expiring, set: setExpiring },
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
              <div className={cn(
                'w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5',
                value ? 'translate-x-4' : 'translate-x-0',
              )} />
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">{label}</div>
            <div className="text-xs text-muted">{desc}</div>
          </div>
        </label>
      ))}
      <p className="text-[11px] text-muted/60 mt-2">{t('reseller.profile.notifFooter')}</p>
    </div>
  );
}

// ─── Account summary section ─────────────────────────────────────────────────

function AccountSummarySection() {
  const { t } = useTranslation();
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
          <div className="text-xs text-muted mt-0.5">{t('reseller.profile.totalUsers')}</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-success">{stats?.activeUsers ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">{t('reseller.profile.activeUsers')}</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-slate-200">{stats?.onlineConnections ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">{t('reseller.profile.liveConnections')}</div>
        </div>
        <div className="bg-surface-2 rounded-xl p-3">
          <div className="text-2xl font-bold text-warning">{stats?.expiredUsers ?? '—'}</div>
          <div className="text-xs text-muted mt-0.5">{t('reseller.profile.expiredUsers')}</div>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-muted">{t('reseller.profile.memberSince')}</span>
          <span className="text-slate-300">
            {me?.createdAt ? new Date(me.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-muted">{t('reseller.profile.tier')}</span>
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
  const { t } = useTranslation();
  const { data: me } = useResellerMe();
  const updateBranding = useUpdateResellerBranding();
  const uploadLogo = useUploadBrandingLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [brandName, setBrandName] = useState('');
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (me) {
      setBrandName(me.brandName ?? '');
      setPreviewLogo(me.logoUrl ?? null);
    }
  }, [me]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBranding.mutateAsync({ brandName });
  };

  const processFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
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
      {/* Logo */}
      <div>
        <label className="text-xs font-medium text-muted block mb-2">{t('reseller.profile.logo')}</label>
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
                onClick={() => {
                  setPreviewLogo(null);
                  updateBranding.mutate({ brandName });
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center hover:bg-danger/80 transition-colors"
                title={t('reseller.profile.removeLogo')}
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
              <p className="text-xs text-slate-300">{t('reseller.profile.fileTypes')}</p>
              <p className="text-[11px] text-muted">{t('reseller.profile.maxSize')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Brand name */}
      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.brandName')}</label>
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={t('reseller.profile.brandPlaceholder')}
            className="input w-full"
          />
          <p className="text-[11px] text-muted mt-1">{t('reseller.profile.brandHint')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={updateBranding.isPending}
            className="btn btn-primary text-sm"
          >
            {updateBranding.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('reseller.profile.saving')}</>
            ) : (
              t('common.save')
            )}
          </button>
          {!updateBranding.isPending && updateBranding.isSuccess && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="w-3 h-3" /> {t('reseller.profile.saved')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function ReferralSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useResellerReferral();
  if (isLoading) return <div className="text-sm text-muted py-2">{t('common.loading')}</div>;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted block mb-1">{t('reseller.profile.referralCode')}</label>
        <div className="flex items-center gap-2">
          <input value={data.referralCode} readOnly className="input flex-1 font-mono" />
          <button type="button" className="btn btn-ghost text-sm inline-flex items-center gap-1"
            onClick={() => { void copyToClipboard(data.referralCode); toast.success(t('common.copied')); }}>
            <Copy className="w-4 h-4" /> {t('common.copy')}
          </button>
        </div>
        <p className="text-xs text-muted mt-1">{t('reseller.profile.referralHint')}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-surface-2 p-3 text-center">
          <div className="text-lg font-bold text-slate-100">{data.referrals}</div>
          <div className="text-[11px] text-muted">{t('reseller.profile.referrals')}</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-3 text-center">
          <div className="text-lg font-bold text-warning">{data.pendingCredits}</div>
          <div className="text-[11px] text-muted">{t('reseller.profile.pendingCredits')}</div>
        </div>
        <div className="rounded-lg bg-surface-2 p-3 text-center">
          <div className="text-lg font-bold text-success">{data.paidCredits}</div>
          <div className="text-[11px] text-muted">{t('reseller.profile.paidCredits')}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ResellerProfilePage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{t('reseller.profile.pageTitle')}</h1>
        <p className="text-sm text-muted">{t('reseller.profile.pageSubtitle')}</p>
      </div>

      <Section title={t('reseller.profile.brandingTitle')} icon={Palette}>
        <BrandingSection />
      </Section>

      <Section title={t('reseller.profile.profileTitle')} icon={User}>
        <ProfileSection />
      </Section>

      <Section title={t('reseller.profile.passwordTitle')} icon={Lock}>
        <PasswordSection />
      </Section>

      <Section title={t('reseller.profile.notifTitle')} icon={Bell}>
        <NotificationsSection />
      </Section>

      <Section title={t('reseller.profile.accountTitle')} icon={BarChart2}>
        <AccountSummarySection />
      </Section>

      <Section title={t('reseller.profile.referralTitle')} icon={Gift}>
        <ReferralSection />
      </Section>
    </div>
  );
}
