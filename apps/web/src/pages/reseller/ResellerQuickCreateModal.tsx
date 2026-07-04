import { useState, useCallback } from 'react';
import {
  AlertTriangle, Check, Copy, Shuffle, RefreshCw, ExternalLink, Zap, Package,
} from 'lucide-react';
import {
  useResellerQuickCreate,
  useResellerQuickCreateWithPackage,
  useResellerPackages,
  useCreditPricing,
  computeCustomCreditCost,
} from '@/hooks/useResellerPanel';
import type { QuickCreateResult } from '@/hooks/useResellerPanel';
import { DEFAULT_CREDIT_PRICING } from '@/hooks/useSettings';
import { Modal } from '@/components/ui/Modal';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type DurationKey = `h:${number}` | `d:${number}` | 'custom';
type ModalTab = 'package' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randStr(len = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultScreen({
  result, onClose, onNew,
}: { result: QuickCreateResult; onClose: () => void; onNew: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success('Kopyalandı');
  }, []);

  return (
    <Modal open onClose={onClose} title="Kullanıcı Oluşturuldu" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-3">
          {[
            { label: 'Kullanıcı Adı', value: result.user.username },
            { label: 'Şifre',         value: result.user.password },
            { label: 'Bitiş',         value: formatDate(result.user.expiresAt) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-200 text-sm">{value}</span>
                <button onClick={() => copy(value, label)} className="text-muted hover:text-fg">
                  {copied === label
                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { label: 'M3U URL',    value: result.m3uUrl },
            { label: 'Player API', value: result.playerApiUrl },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted">{label}</span>
              <div className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5">
                <span className="font-mono text-xs text-muted truncate flex-1">{value}</span>
                <button onClick={() => copy(value, label)} className="shrink-0 text-muted hover:text-fg">
                  {copied === label
                    ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
                <a href={value} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-fg">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onNew} className="btn-ghost flex-1 text-sm">Yeni Kullanıcı</button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm">Kapat</button>
        </div>
      </div>
    </Modal>
  );
}

function CredentialRow({
  label, value, random, onToggleRandom, onChange,
}: {
  label: string; value: string; random: boolean;
  onToggleRandom: () => void; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <button
          onClick={onToggleRandom}
          className={cn(
            'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full',
            random ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted',
          )}
        >
          <Shuffle className="w-2.5 h-2.5" />
        </button>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={random ? 'Otomatik' : label.toLowerCase()}
        disabled={random}
        className="input w-full text-sm disabled:opacity-40"
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ResellerQuickCreateModal({
  onClose,
  credits,
}: {
  onClose: () => void;
  credits: number;
}) {
  const customMutation  = useResellerQuickCreate();
  const packageMutation = useResellerQuickCreateWithPackage();
  const { data: packages = [] } = useResellerPackages();
  const { data: pricingData }   = useCreditPricing();

  const pricing = pricingData ?? DEFAULT_CREDIT_PRICING;

  // ── Tab ──
  const [tab, setTab] = useState<ModalTab>(packages.length > 0 ? 'package' : 'custom');

  // ── Credentials ──
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [randomUser,  setRandomUser]  = useState(true);
  const [randomPass,  setRandomPass]  = useState(true);
  const [notes,       setNotes]       = useState('');
  const [result,      setResult]      = useState<QuickCreateResult | null>(null);

  // ── Package tab ──
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const selectedPkg   = packages.find((p) => p.id === selectedPkgId);
  const pkgInsufficient = selectedPkg ? credits < selectedPkg.creditCost : false;

  // ── Custom tab ──
  const [durationKey,    setDurationKey]    = useState<DurationKey>('d:30');
  const [customDays,     setCustomDays]     = useState('30');
  const [connections,    setConnections]    = useState(1);
  const [useCustomConns, setUseCustomConns] = useState(false);
  const [customConns,    setCustomConns]    = useState(1);

  const effectiveConns = useCustomConns ? customConns : connections;

  // Compute credit cost for the selected custom duration
  const creditCost = (() => {
    if (durationKey === 'custom') {
      return computeCustomCreditCost(parseInt(customDays) || 30, pricing);
    }
    const [type, val] = durationKey.split(':');
    if (type === 'h') {
      const match = pricing.testDurations.find((d) => d.hours === Number(val));
      return Math.max(0, match?.credits ?? 0);
    }
    return computeCustomCreditCost(Number(val), pricing);
  })();

  const isPending = customMutation.isPending || packageMutation.isPending;
  const customInsufficient = creditCost > credits;

  const disabled = isPending || (
    tab === 'package'
      ? !selectedPkgId || pkgInsufficient
      : customInsufficient
  );

  const handleCreate = async () => {
    const u = randomUser ? randStr(8) : username.trim();
    const p = randomPass ? randStr(8) : password.trim();
    if (!u || !p) { toast.error('Kullanıcı adı ve şifre gerekli'); return; }

    if (tab === 'package') {
      if (!selectedPkgId) { toast.error('Paket seçin'); return; }
      const data = await packageMutation.mutateAsync({
        username: u, password: p, packageId: selectedPkgId,
        notes: notes.trim() || undefined,
      });
      setResult(data);
    } else {
      let payload: { durationDays?: number; durationHours?: number } = {};
      if (durationKey === 'custom') {
        payload = { durationDays: parseInt(customDays) || 30 };
      } else {
        const [type, val] = durationKey.split(':');
        if (type === 'h') payload = { durationHours: Number(val) };
        else payload = { durationDays: Number(val) };
      }
      const data = await customMutation.mutateAsync({
        username: u, password: p, ...payload,
        maxConnections: effectiveConns,
        notes: notes.trim() || undefined,
      });
      setResult(data);
    }
  };

  if (result) {
    return (
      <ResultScreen
        result={result}
        onClose={onClose}
        onNew={() => { setResult(null); setUsername(''); setPassword(''); }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title="⚡ Hızlı Hat Ekle" size="sm">
      <div className="space-y-4">

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-surface-2 p-0.5 gap-0.5">
          {([['package', Package, 'Paket Seç'], ['custom', Zap, 'Özel Süre']] as const).map(([key, Icon, lbl]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors',
                tab === key ? 'bg-primary/20 text-primary' : 'text-muted hover:text-slate-300',
              )}
            >
              <Icon className="w-3 h-3" />{lbl}
            </button>
          ))}
        </div>

        {/* ── Package tab ── */}
        {tab === 'package' && (
          <>
            {packages.length === 0 ? (
              <p className="text-center text-sm text-muted py-4">Henüz aktif paket tanımlanmamış.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {packages.map((pkg) => {
                  const insufficient = credits < pkg.creditCost;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => !insufficient && setSelectedPkgId(pkg.id)}
                      disabled={insufficient}
                      className={cn(
                        'text-left p-3 rounded-xl border transition-all',
                        selectedPkgId === pkg.id
                          ? 'border-primary bg-primary/10'
                          : insufficient
                            ? 'border-border opacity-40 cursor-not-allowed'
                            : 'border-border hover:border-primary/50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-200">{pkg.name}</span>
                        <span className={cn(
                          'text-xs font-semibold px-1.5 py-0.5 rounded',
                          insufficient ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary',
                        )}>
                          {pkg.creditCost} kredi
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{pkg.durationDays} gün</span>
                        <span>·</span>
                        <span>{pkg.maxConnections} bağlantı</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPkg && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted">
                <span className="text-slate-300 font-medium">{selectedPkg.name}</span>
                {' '}— {selectedPkg.durationDays} gün / {selectedPkg.maxConnections} bağlantı /{' '}
                <span className="text-primary font-semibold">{selectedPkg.creditCost} kredi</span>
                {pkgInsufficient && <span className="ml-2 text-danger font-semibold">Yetersiz kredi!</span>}
              </div>
            )}
          </>
        )}

        {/* ── Custom tab ── */}
        {tab === 'custom' && (
          <>
            {customInsufficient && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Yetersiz kredi. Yöneticinizle iletişime geçin.
              </div>
            )}

            <p className="text-xs text-muted">
              Bu işlem{' '}
              <span className="text-primary font-medium">{creditCost} kredi</span>
              {' '}düşecek (mevcut: {credits})
            </p>

            {/* Duration — Test */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted">Süre — Test</label>
              <div className="flex flex-wrap gap-1.5">
                {pricing.testDurations.map((p) => {
                  const key: DurationKey = `h:${p.hours}`;
                  return (
                    <button
                      key={p.hours}
                      onClick={() => setDurationKey(key)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                        durationKey === key
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'border-border text-muted hover:border-primary/50',
                      )}
                    >
                      {p.label}{p.credits > 0 ? ` (${p.credits}k)` : ''}
                    </button>
                  );
                })}
              </div>

              {/* Duration — Standard */}
              <label className="text-xs font-medium text-muted">Süre — Standart</label>
              <div className="flex flex-wrap gap-1.5">
                {pricing.durations.map((p) => {
                  const key: DurationKey = `d:${p.days}`;
                  return (
                    <button
                      key={p.days}
                      onClick={() => setDurationKey(key)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                        durationKey === key
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'border-border text-muted hover:border-primary/50',
                      )}
                    >
                      {p.label} ({p.credits}k)
                    </button>
                  );
                })}
                <button
                  onClick={() => setDurationKey('custom')}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                    durationKey === 'custom'
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted hover:border-primary/50',
                  )}
                >
                  Özel
                </button>
              </div>

              {durationKey === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={3650} value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="input w-24 text-sm"
                  />
                  <span className="text-xs text-muted">gün</span>
                  <span className="text-xs text-primary font-medium">= {creditCost} kredi</span>
                </div>
              )}
            </div>

            {/* Connections */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted">Bağlantı Sayısı</label>
                <button
                  onClick={() => setUseCustomConns((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors',
                    useCustomConns ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-muted',
                  )}
                >
                  Özel
                </button>
              </div>
              {useCustomConns ? (
                <input
                  type="number" min={1} max={10} value={customConns}
                  onChange={(e) => setCustomConns(+e.target.value)}
                  className="input w-20"
                />
              ) : (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setConnections(n)}
                      className={cn(
                        'w-9 h-9 rounded-lg text-sm font-medium border transition-colors',
                        connections === n
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'border-border text-muted hover:border-primary/50',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Credentials — always shown */}
        <div className="grid grid-cols-2 gap-3">
          <CredentialRow
            label="Kullanıcı Adı"
            value={username}
            random={randomUser}
            onToggleRandom={() => setRandomUser((v) => !v)}
            onChange={setUsername}
          />
          <CredentialRow
            label="Şifre"
            value={password}
            random={randomPass}
            onToggleRandom={() => setRandomPass((v) => !v)}
            onChange={setPassword}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted">Not (opsiyonel)</label>
          <input
            type="text" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Müşteri notu…"
            className="input w-full text-sm"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">İptal</button>
          <button
            onClick={() => void handleCreate()}
            disabled={disabled}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
          >
            {isPending
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
            Oluştur
          </button>
        </div>

      </div>
    </Modal>
  );
}
