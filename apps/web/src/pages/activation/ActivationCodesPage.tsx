import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Check, Ban, Power, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useActivationCodes,
  useGenerateCodes,
  useDisableCode,
  useEnableCode,
  type ActivationCode,
  type LineStatus,
} from '@/hooks/useActivation';
import { usePackages } from '@/hooks/usePackages';
import { copyToClipboard } from '@/lib/utils';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const LINE_BADGE: Record<LineStatus, string> = {
  ACTIVE: 'bg-success/10 text-success',
  DISABLED: 'bg-danger/10 text-danger',
  EXPIRED: 'bg-warning/10 text-warning',
  DELETED: 'bg-muted/10 text-muted',
  BANNED: 'bg-danger/10 text-danger',
};

export function ActivationCodesPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useActivationCodes(statusFilter || undefined);
  const { data: packages } = usePackages();
  const generate = useGenerateCodes();
  const disable = useDisableCode();
  const enable = useEnableCode();

  const [count, setCount] = useState(10);
  const [packageId, setPackageId] = useState<string>('');
  const [durationDays, setDurationDays] = useState(30);
  const [maxConnections, setMaxConnections] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [lastCodes, setLastCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const items = data?.items ?? [];
  const usingPackage = packageId !== '';

  const doGenerate = () => {
    if (count < 1) return;
    if (!usingPackage && durationDays < 1) return;
    generate.mutate(
      {
        count,
        packageId: usingPackage ? packageId : undefined,
        durationDays: usingPackage ? undefined : durationDays,
        maxConnections: maxConnections === '' ? undefined : Number(maxConnections),
        note: note.trim() || undefined,
      },
      {
        onSuccess: (d) => { setLastCodes(d.codes); toast.success(t('activation.generated', { n: d.generated })); },
        onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.error')),
      },
    );
  };

  const copyAll = (codes: string[]) => { void copyToClipboard(codes.join('\n')); toast.success(t('activation.copiedAll', { n: codes.length })); };
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

  const filters: { key: string; label: string }[] = [
    { key: '', label: t('activation.all') },
    { key: 'ACTIVE', label: t('activation.statusActive') },
    { key: 'DISABLED', label: t('activation.statusDisabled') },
  ];

  return (
    <div>
      <PageHeader title={t('activation.title')} description={t('activation.subtitle')} />

      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
          <Plus className="w-4 h-4 text-primary" /> {t('activation.generateTitle')}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">{t('activation.count')}</label>
            <input type="number" min={1} max={100} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">{t('activation.packageOptional')}</label>
            <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">{t('activation.noPackage')}</option>
              {(packages ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.durationDays}{t('activation.dayShort')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">{t('activation.durationDays')}</label>
            <input type="number" min={1} className="input disabled:opacity-40" disabled={usingPackage} value={durationDays} onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">{t('activation.maxConnOptional')}</label>
            <input type="number" min={1} className="input" value={maxConnections} onChange={(e) => setMaxConnections(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))} placeholder="—" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">{t('activation.note')}</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('activation.notePlaceholder')} />
          </div>
        </div>
        <p className="text-xs text-muted mt-3">{t('activation.generateHint')}</p>
        <div className="mt-3">
          <button className="btn-primary" disabled={generate.isPending} onClick={doGenerate}>
            {generate.isPending ? t('common.loading') : t('activation.generateBtn', { n: count })}
          </button>
        </div>

        {lastCodes.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">{t('activation.freshCodes', { n: lastCodes.length })}</span>
              <button className="btn-ghost text-xs inline-flex items-center gap-1" onClick={() => copyAll(lastCodes)}>
                <Download className="w-3.5 h-3.5" /> {t('activation.copyAll')}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {lastCodes.map((c) => (
                <div key={c} className="flex items-center gap-1.5 bg-surface-2 rounded px-2 py-1">
                  <span className="font-mono text-xs text-slate-200 flex-1 truncate">{c}</span>
                  <button className="btn-ghost p-0.5" onClick={() => { void copyToClipboard(c); setCopied(c); setTimeout(() => setCopied(null), 1200); }}>
                    {copied === c ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 mb-3">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm', statusFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{t('activation.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                  <th className="px-4 py-2.5">{t('activation.code')}</th>
                  <th className="px-4 py-2.5">{t('activation.lineStatus')}</th>
                  <th className="px-4 py-2.5">{t('activation.expiresAt')}</th>
                  <th className="px-4 py-2.5">{t('activation.activeConn')}</th>
                  <th className="px-4 py-2.5">{t('activation.maxConn')}</th>
                  <th className="px-4 py-2.5">{t('activation.note')}</th>
                  <th className="px-4 py-2.5 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c: ActivationCode) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-200">{c.code}</span>
                        <button className="btn-ghost p-0.5" onClick={() => { void copyToClipboard(c.code); setCopied(c.code); setTimeout(() => setCopied(null), 1200); }}>
                          {copied === c.code ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('badge', LINE_BADGE[c.lineStatus] ?? 'bg-muted/10 text-muted')}>
                        {t(`activation.line${c.lineStatus.charAt(0) + c.lineStatus.slice(1).toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{fmtDate(c.expiresAt)}</td>
                    <td className="px-4 py-2.5 text-muted">{c.activeConnections}</td>
                    <td className="px-4 py-2.5 text-muted">{c.maxConnections ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted truncate max-w-[160px]">{c.note ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {c.status === 'ACTIVE' ? (
                        <button className="btn-ghost p-1.5" title={t('activation.disable')} onClick={() => disable.mutate(c.id)}>
                          <Ban className="w-4 h-4 text-danger" />
                        </button>
                      ) : (
                        <button className="btn-ghost p-1.5" title={t('activation.enable')} onClick={() => enable.mutate(c.id)}>
                          <Power className="w-4 h-4 text-success" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
