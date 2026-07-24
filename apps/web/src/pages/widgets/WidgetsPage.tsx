import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Code2, Copy, Check, List, Zap, ShoppingBag, RefreshCw, ExternalLink, Link2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { copyToClipboard, cn, formatDate } from '@/lib/utils';
import { usePackages } from '@/hooks/usePackages';
import {
  useWidgets,
  useWidgetLeads,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
  type Widget,
  type WidgetType,
  type WidgetPayload,
} from '@/hooks/useWidgets';

const TYPE_ICON: Record<WidgetType, typeof Zap> = { TRIAL: Zap, STORE: ShoppingBag, RENEWAL: RefreshCw };

function embedSnippet(w: Widget): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://panel';
  return `<script src="${origin}/api/v1/public/widgets/embed.js" data-key="${w.publicKey}" async></script>`;
}

function hostedUrl(w: Widget): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://panel';
  return `${origin}/w/${w.publicKey}`;
}

function emptyForm(): WidgetPayload {
  return { name: '', type: 'STORE', enabled: true, accentColor: '#6d28d9', trialDurationDays: 1, allowedPackageIds: [], perIpDailyLimit: 5, oneTrialPerDevice: true };
}

export function WidgetsPage() {
  const { t } = useTranslation();
  const { data: widgets = [], isLoading } = useWidgets();
  const { data: packages = [] } = usePackages();
  const create = useCreateWidget();
  const update = useUpdateWidget();
  const del = useDeleteWidget();

  const publicPackages = useMemo(() => packages.filter((p) => p.isPublic), [packages]);

  const [editing, setEditing] = useState<Widget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WidgetPayload>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [leadsFor, setLeadsFor] = useState<Widget | null>(null);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (w: Widget) => {
    setEditing(w);
    setForm({
      name: w.name, type: w.type, enabled: w.enabled, title: w.title ?? '', subtitle: w.subtitle ?? '',
      accentColor: w.accentColor, trialDurationDays: w.trialDurationDays, allowedPackageIds: w.allowedPackageIds ?? [],
      successMessage: w.successMessage ?? '', redirectUrl: w.redirectUrl ?? '', perIpDailyLimit: w.perIpDailyLimit, oneTrialPerDevice: w.oneTrialPerDevice ?? true,
    });
    setShowForm(true);
  };

  const save = () => {
    const payload: WidgetPayload = { ...form, name: form.name?.trim() || 'Widget' };
    const done = () => setShowForm(false);
    if (editing) update.mutate({ id: editing.id, payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  };

  const doCopy = async (w: Widget, which: 'embed' | 'hosted' = 'embed') => {
    const ok = await copyToClipboard(which === 'hosted' ? hostedUrl(w) : embedSnippet(w));
    if (ok) { const id = which === 'hosted' ? w.id + 'hosted' : w.id; setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); }
  };

  const isStore = form.type === 'STORE' || form.type === 'RENEWAL';
  const saving = create.isPending || update.isPending;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('widgets.title')}
        description={t('widgets.subtitle')}
        actions={<button className="btn-primary" onClick={openNew}><Plus className="w-4 h-4" /> {t('widgets.add')}</button>}
      />

      {isLoading ? (
        <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
      ) : widgets.length === 0 ? (
        <div className="card p-10 flex flex-col items-center gap-3 text-muted">
          <Code2 className="w-10 h-10 opacity-40" />
          <p className="text-sm">{t('widgets.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgets.map((w) => {
            const Icon = TYPE_ICON[w.type];
            return (
              <div key={w.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: w.accentColor + '22', color: w.accentColor }}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg truncate">{w.name}</div>
                      <div className="text-[11px] text-muted">{t(`widgets.type${w.type}`)}</div>
                    </div>
                  </div>
                  <span className={cn('badge', w.enabled ? 'text-success bg-success/10' : 'text-muted bg-surface-2')}>
                    {w.enabled ? '●' : '○'} {t('widgets.enabled')}
                  </span>
                </div>

                <div className="rounded-lg border p-2" style={{ borderColor: w.accentColor + '55', background: w.accentColor + '0d' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> {t('widgets.hostedLink')}</span>
                    <div className="flex items-center gap-2">
                      <a href={hostedUrl(w)} target="_blank" rel="noreferrer" className="text-[11px] text-primary inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {t('widgets.openPage')}</a>
                      <button className="text-[11px] text-primary inline-flex items-center gap-1" onClick={() => doCopy(w, 'hosted')}>
                        {copiedId === w.id + 'hosted' ? <><Check className="w-3 h-3" /> {t('widgets.copied')}</> : <><Copy className="w-3 h-3" /> {t('widgets.copy')}</>}
                      </button>
                    </div>
                  </div>
                  <code className="block text-[11px] font-mono text-fg break-all">{hostedUrl(w)}</code>
                </div>

                <div className="rounded-lg bg-surface-2 border border-border p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted">{t('widgets.embed')}</span>
                    <button className="text-[11px] text-primary inline-flex items-center gap-1" onClick={() => doCopy(w)}>
                      {copiedId === w.id ? <><Check className="w-3 h-3" /> {t('widgets.copied')}</> : <><Copy className="w-3 h-3" /> {t('widgets.copy')}</>}
                    </button>
                  </div>
                  <code className="block text-[10px] font-mono text-fg break-all leading-relaxed">{embedSnippet(w)}</code>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border mt-1">
                  <button className="btn-ghost text-xs" onClick={() => setLeadsFor(w)}><List className="w-3.5 h-3.5" /> {t('widgets.leads')}</button>
                  <button className="btn-ghost text-xs" onClick={() => openEdit(w)}><Pencil className="w-3.5 h-3.5" /> {t('widgets.edit')}</button>
                  <button className="btn-ghost text-xs text-danger ml-auto" onClick={() => setDeleteId(w.id)}><Trash2 className="w-3.5 h-3.5" /> {t('widgets.deleteTitle')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('widgets.editTitle') : t('widgets.addTitle')} size="lg">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('widgets.name')}</label>
              <input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('widgets.type')}</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as WidgetType })}>
                <option value="TRIAL">{t('widgets.typeTRIAL')}</option>
                <option value="STORE">{t('widgets.typeSTORE')}</option>
                <option value="RENEWAL">{t('widgets.typeRENEWAL')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('widgets.wTitle')}</label>
              <input className="input" value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('widgets.wSubtitle')}</label>
              <input className="input" value={form.subtitle ?? ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="label">{t('widgets.accent')}</label>
              <input type="color" className="input h-10 p-1" value={form.accentColor ?? '#6d28d9'} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" className="accent-primary" checked={form.enabled ?? true} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span className="text-sm text-fg">{t('widgets.enabled')}</span>
            </label>
          </div>

          {form.type === 'TRIAL' && (
            <div className="space-y-2">
              <div>
                <label className="label">{t('widgets.trialDuration')}</label>
                <input type="number" min={1} max={365} className="input" value={form.trialDurationDays ?? 1} onChange={(e) => setForm({ ...form, trialDurationDays: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={form.oneTrialPerDevice ?? true} onChange={(e) => setForm({ ...form, oneTrialPerDevice: e.target.checked })} />
                <span className="text-sm text-fg">{t('widgets.oneDevice')}</span>
              </label>
            </div>
          )}

          {isStore && (
            <div>
              <label className="label">{t('widgets.packages')}</label>
              <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y divide-border/50">
                {publicPackages.length === 0 ? (
                  <div className="text-xs text-muted p-2">{t('widgets.packagesHint')}</div>
                ) : publicPackages.map((p) => {
                  const checked = (form.allowedPackageIds ?? []).includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-surface-2">
                      <input type="checkbox" className="accent-primary" checked={checked} onChange={(e) => {
                        const cur = new Set(form.allowedPackageIds ?? []);
                        if (e.target.checked) cur.add(p.id); else cur.delete(p.id);
                        setForm({ ...form, allowedPackageIds: Array.from(cur) });
                      }} />
                      <span className="flex-1 text-fg">{p.name}</span>
                      <span className="text-xs text-muted">{p.durationDays}d · {p.price}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-1">{t('widgets.packagesHint')}</p>
            </div>
          )}

          <div>
            <label className="label">{t('widgets.successMsg')}</label>
            <input className="input" value={form.successMessage ?? ''} onChange={(e) => setForm({ ...form, successMessage: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('widgets.redirect')}</label>
              <input className="input font-mono text-xs" placeholder="https://..." value={form.redirectUrl ?? ''} onChange={(e) => setForm({ ...form, redirectUrl: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('widgets.ipLimit')}</label>
              <input type="number" min={0} max={1000} className="input" value={form.perIpDailyLimit ?? 5} onChange={(e) => setForm({ ...form, perIpDailyLimit: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button className="btn-ghost" onClick={() => setShowForm(false)}>{t('providers.mirror.cancel')}</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '…' : t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Leads */}
      <Modal open={!!leadsFor} onClose={() => setLeadsFor(null)} title={leadsFor ? `${t('widgets.leads')} — ${leadsFor.name}` : ''} size="xl">
        {leadsFor && <LeadsTable widgetId={leadsFor.id} open={!!leadsFor} />}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={t('widgets.deleteTitle')}
        message={t('widgets.deleteConfirm')}
        onConfirm={() => { if (deleteId) del.mutate(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}

function LeadsTable({ widgetId, open }: { widgetId: string; open: boolean }) {
  const { t } = useTranslation();
  const { data: leads = [], isLoading } = useWidgetLeads(widgetId, open);
  if (isLoading) return <div className="h-24 flex items-center justify-center"><LoadingSpinner /></div>;
  if (leads.length === 0) return <div className="text-sm text-muted p-4 text-center">{t('widgets.noLeads')}</div>;
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="text-muted text-left sticky top-0 bg-surface">
          <tr>
            <th className="py-1.5 pr-2">{t('widgets.colWhen')}</th>
            <th className="py-1.5 pr-2">{t('widgets.type')}</th>
            <th className="py-1.5 pr-2">{t('widgets.colContact')}</th>
            <th className="py-1.5 pr-2">{t('widgets.colIp')}</th>
            <th className="py-1.5">{t('widgets.colResult')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {leads.map((l) => (
            <tr key={l.id}>
              <td className="py-1.5 pr-2 text-muted whitespace-nowrap">{formatDate(l.createdAt)}</td>
              <td className="py-1.5 pr-2">{l.type}</td>
              <td className="py-1.5 pr-2 text-fg truncate max-w-[160px]">{l.email || l.username || '—'}</td>
              <td className="py-1.5 pr-2 font-mono text-muted">{l.ip || '—'}</td>
              <td className="py-1.5">
                <span className={cn('badge', l.result === 'OK' ? 'text-success bg-success/10' : l.result === 'LIMITED' ? 'text-amber-500 bg-amber-500/10' : 'text-danger bg-danger/10')}>{l.result}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
