import { useEffect, useMemo, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, Check, Copy, Zap, ShoppingBag, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePublicWidget, useSubmitPublicWidget, type WidgetSubmitResult } from '@/hooks/useWidgets';
import { copyToClipboard } from '@/lib/utils';

function hexToRgba(hex: string, a: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#6d28d9');
  if (!m) return `rgba(109,40,217,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function deviceFp(): string {
  try {
    const parts: (string | number)[] = [navigator.userAgent, navigator.language, (navigator as { platform?: string }).platform ?? '', `${screen.width}x${screen.height}`, screen.colorDepth, new Date().getTimezoneOffset(), (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 0];
    try {
      const cv = document.createElement('canvas'); const cx = cv.getContext('2d');
      if (cx) { cx.textBaseline = 'top'; cx.font = '14px Arial'; cx.fillStyle = '#f60'; cx.fillRect(0, 0, 60, 20); cx.fillStyle = '#069'; cx.fillText('xp-fp', 2, 2); parts.push(cv.toDataURL().slice(-64)); }
    } catch { /* ignore */ }
    const str = parts.join('|');
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    return 'd' + h.toString(16) + str.length.toString(16);
  } catch { return ''; }
}

export function WidgetHostedPage() {
  const { t } = useTranslation();
  const { key } = useParams({ strict: false }) as { key?: string };
  const { data: cfg, isLoading, isError } = usePublicWidget(key);
  const submit = useSubmitPublicWidget(key);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [packageId, setPackageId] = useState('');
  const [result, setResult] = useState<WidgetSubmitResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const accent = cfg?.accentColor || '#6d28d9';

  useEffect(() => {
    if (cfg?.packages && cfg.packages.length && !packageId) setPackageId(cfg.packages[0].id);
  }, [cfg, packageId]);

  useEffect(() => {
    if (result?.redirectUrl) {
      const url = result.redirectUrl;
      const timer = setTimeout(() => { window.location.href = url; }, 2000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const TypeIcon = useMemo(() => (cfg?.type === 'TRIAL' ? Zap : cfg?.type === 'RENEWAL' ? RefreshCw : ShoppingBag), [cfg]);

  const doCopy = async (label: string, value: string) => {
    if (await copyToClipboard(value)) { setCopied(label); setTimeout(() => setCopied(null), 1500); }
  };

  const run = () => {
    setResult(null);
    submit.mutate(
      { email: email.trim() || undefined, username: username.trim() || undefined, packageId: packageId || undefined, deviceId: deviceFp() },
      { onSuccess: (r) => setResult(r) },
    );
  };

  const pageBg = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: `linear-gradient(135deg, ${hexToRgba(accent, 0.16)}, ${hexToRgba(accent, 0.04)})` } as const;
  const card = { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,.12)', padding: 28, color: '#111' } as const;

  if (isLoading) {
    return <div style={pageBg}><Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} /></div>;
  }
  if (isError || !cfg || cfg.enabled === false) {
    return (
      <div style={pageBg}>
        <div style={card}>
          <div className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" /> {t('widgets.hosted.unavailable')}</div>
        </div>
      </div>
    );
  }

  const heading = cfg.title || (cfg.type === 'TRIAL' ? t('widgets.hosted.trialTitle') : cfg.type === 'RENEWAL' ? t('widgets.hosted.renewTitle') : t('widgets.hosted.storeTitle'));
  const isStore = cfg.type === 'STORE' || cfg.type === 'RENEWAL';

  const CopyRow = ({ label, value }: { label: string; value?: string }) => value ? (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'ui-monospace,monospace', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, wordBreak: 'break-all' }}>
        <span style={{ flex: 1 }}>{value}</span>
        <button onClick={() => doCopy(label, value)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: accent, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          {copied === label ? <><Check className="w-3 h-3" /> {t('widgets.hosted.copied')}</> : <><Copy className="w-3 h-3" /> {t('widgets.hosted.copy')}</>}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div style={pageBg}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: hexToRgba(accent, 0.14), color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TypeIcon className="w-5 h-5" />
          </span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{heading}</h1>
        </div>
        {cfg.subtitle && <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>{cfg.subtitle}</p>}

        {result ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: 14, fontSize: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}><Check className="w-4 h-4" />
                {result.message || (result.type === 'TRIAL' ? t('widgets.hosted.trialReady') : result.type === 'RENEWAL' ? t('widgets.hosted.renewReceived') : t('widgets.hosted.orderReceived'))}
              </div>
              {result.type === 'TRIAL' && (result.username || result.password) && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#065f46' }}>{t('widgets.hosted.yourLogin')}</div>
                  <CopyRow label={t('widgets.hosted.usernameL')} value={result.username} />
                  <CopyRow label={t('widgets.hosted.passwordL')} value={result.password} />
                  <CopyRow label={t('widgets.hosted.m3uL')} value={result.m3uUrl} />
                </div>
              )}
            </div>
            <button onClick={() => { setResult(null); setEmail(''); setUsername(''); }} style={{ marginTop: 14, width: '100%', padding: 11, borderRadius: 10, border: `1px solid ${accent}`, background: '#fff', color: accent, fontWeight: 600, cursor: 'pointer' }}>
              {t('widgets.hosted.again')}
            </button>
          </div>
        ) : (
          <div>
            {isStore && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 600 }}>{t('widgets.hosted.package')}</label>
                <select value={packageId} onChange={(e) => setPackageId(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14 }}>
                  {(cfg.packages ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.price ? ` — ${p.price}` : ''}</option>)}
                </select>
              </div>
            )}
            {cfg.type === 'RENEWAL' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 600 }}>{t('widgets.hosted.username')}</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14 }} />
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 600 }}>{cfg.type === 'TRIAL' ? t('widgets.hosted.emailOptional') : t('widgets.hosted.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14 }} />
            </div>
            {submit.isError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: 10, fontSize: 13, marginBottom: 10 }}>
                {(submit.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'}
              </div>
            )}
            <button onClick={run} disabled={submit.isPending} style={{ width: '100%', padding: 13, borderRadius: 10, border: 0, background: accent, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: submit.isPending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {submit.isPending ? t('widgets.hosted.working') : cfg.type === 'TRIAL' ? t('widgets.hosted.getTrial') : cfg.type === 'RENEWAL' ? t('widgets.hosted.renew') : t('widgets.hosted.buy')}
            </button>
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>{t('widgets.hosted.poweredBy')} XtreamPulsar</div>
      </div>
    </div>
  );
}
