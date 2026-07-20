import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Printer, Check, Undo2, Ban, Trash2, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { useInvoices, useCreateInvoice, useSetInvoiceStatus, useDeleteInvoice, type Invoice, type InvoiceStatus } from '@/hooks/useInvoices';
import { useSettings } from '@/hooks/useSettings';
import { formatMoney } from '@/lib/currency';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  UNPAID: 'bg-warning/10 text-warning',
  PAID: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
};

function printInvoice(inv: Invoice, panelName: string, t: (k: string) => string) {
  const money = formatMoney(inv.amount, inv.currency);
  const esc = (v: string) => v.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:32px auto;padding:0 24px}
    h1{font-size:22px;margin:0 0 4px}.muted{color:#666;font-size:13px}
    .row{display:flex;justify-content:space-between;align-items:flex-start;margin-top:24px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e5e5e5;font-size:14px}
    th{color:#666;font-weight:600;font-size:12px;text-transform:uppercase}
    .total{text-align:right;font-size:20px;font-weight:700;margin-top:16px}
    .status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:#eee}
    @media print{body{margin:0}}
  </style></head><body>
    <div class="row">
      <div><h1>${esc(panelName)}</h1><div class="muted">${t('invoices.invoice')}</div></div>
      <div style="text-align:right"><div style="font-weight:700">${esc(inv.number)}</div>
        <div class="muted">${new Date(inv.createdAt).toLocaleDateString()}</div></div>
    </div>
    <div class="row">
      <div><div class="muted">${t('invoices.billedTo')}</div><div style="font-weight:600">${esc(inv.customerName)}</div>
        ${inv.customerEmail ? `<div class="muted">${esc(inv.customerEmail)}</div>` : ''}</div>
      <div><span class="status">${inv.status}</span></div>
    </div>
    <table><thead><tr><th>${t('invoices.description')}</th><th style="text-align:right">${t('invoices.amount')}</th></tr></thead>
      <tbody><tr><td>${esc(inv.description)}</td><td style="text-align:right">${money}</td></tr></tbody></table>
    <div class="total">${t('invoices.total')}: ${money}</div>
    ${inv.notes ? `<p class="muted">${esc(inv.notes)}</p>` : ''}
  </body></html>`;
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, isLoading } = useInvoices(statusFilter || undefined);
  const create = useCreateInvoice();
  const setStatus = useSetInvoiceStatus();
  const del = useDeleteInvoice();
  const settings = useSettings();
  const panelName = settings?.general?.panelName || 'IPTV';

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerEmail: '', description: '', amount: '', notes: '' });

  const items = data?.items ?? [];
  const curr = data?.items[0]?.currency ?? 'TRY';

  const submit = () => {
    const amount = parseFloat(form.amount);
    if (!form.customerName.trim() || !form.description.trim() || !isFinite(amount)) { toast.error(t('common.error')); return; }
    create.mutate(
      { customerName: form.customerName.trim(), customerEmail: form.customerEmail.trim() || undefined, description: form.description.trim(), amount, notes: form.notes.trim() || undefined },
      { onSuccess: () => { setShowCreate(false); setForm({ customerName: '', customerEmail: '', description: '', amount: '', notes: '' }); toast.success(t('invoices.created')); } },
    );
  };

  const filters = [
    { key: '', label: t('invoices.all') },
    { key: 'UNPAID', label: t('invoices.statusUnpaid') },
    { key: 'PAID', label: t('invoices.statusPaid') },
    { key: 'CANCELLED', label: t('invoices.statusCancelled') },
  ];

  return (
    <div>
      <PageHeader title={t('invoices.title')} description={t('invoices.subtitle')}
        actions={<button className="btn-primary inline-flex items-center gap-1.5" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t('invoices.new')}</button>} />

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card p-4"><div className="text-xs text-muted">{t('invoices.totalPaid')}</div>
          <div className="text-xl font-bold text-success mt-1">{formatMoney(data?.totalPaid ?? 0, curr)}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">{t('invoices.totalUnpaid')}</div>
          <div className="text-xl font-bold text-warning mt-1">{formatMoney(data?.totalUnpaid ?? 0, curr)}</div></div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={cn('px-3 py-1.5 rounded-lg text-sm', statusFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>{f.label}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center"><Receipt className="w-8 h-8 text-muted mx-auto mb-2 opacity-40" /><p className="text-sm text-muted">{t('invoices.empty')}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-2.5">{t('invoices.number')}</th>
                <th className="px-4 py-2.5">{t('invoices.customer')}</th>
                <th className="px-4 py-2.5">{t('invoices.description')}</th>
                <th className="px-4 py-2.5">{t('invoices.amount')}</th>
                <th className="px-4 py-2.5">{t('invoices.status')}</th>
                <th className="px-4 py-2.5">{t('invoices.date')}</th>
                <th className="px-4 py-2.5 text-right">{t('common.actions')}</th>
              </tr></thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-200">{inv.number}</td>
                    <td className="px-4 py-2.5">{inv.customerName}</td>
                    <td className="px-4 py-2.5 text-muted truncate max-w-[200px]">{inv.description}</td>
                    <td className="px-4 py-2.5 font-medium">{formatMoney(inv.amount, inv.currency)}</td>
                    <td className="px-4 py-2.5"><span className={cn('badge', STATUS_BADGE[inv.status])}>{t(`invoices.status${inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}`)}</span></td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button className="btn-ghost p-1.5" title={t('invoices.print')} onClick={() => printInvoice(inv, panelName, t)}><Printer className="w-4 h-4" /></button>
                      {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                        <button className="btn-ghost p-1.5" title={t('invoices.markPaid')} onClick={() => setStatus.mutate({ id: inv.id, status: 'paid' })}><Check className="w-4 h-4 text-success" /></button>
                      )}
                      {inv.status === 'PAID' && (
                        <button className="btn-ghost p-1.5" title={t('invoices.markUnpaid')} onClick={() => setStatus.mutate({ id: inv.id, status: 'unpaid' })}><Undo2 className="w-4 h-4 text-warning" /></button>
                      )}
                      {inv.status !== 'CANCELLED' && (
                        <button className="btn-ghost p-1.5" title={t('invoices.cancel')} onClick={() => setStatus.mutate({ id: inv.id, status: 'cancel' })}><Ban className="w-4 h-4 text-danger" /></button>
                      )}
                      <button className="btn-ghost p-1.5" title={t('common.delete')} onClick={() => { if (confirm(t('invoices.deleteConfirm'))) del.mutate(inv.id); }}><Trash2 className="w-4 h-4 text-danger" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('invoices.new')} size="sm">
        <div className="space-y-3 p-6">
          <div><label className="label">{t('invoices.customer')} *</label>
            <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
          <div><label className="label">{t('invoices.email')}</label>
            <input type="email" className="input" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></div>
          <div><label className="label">{t('invoices.description')} *</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('invoices.descPlaceholder')} /></div>
          <div><label className="label">{t('invoices.amount')} *</label>
            <input type="number" step="0.01" min="0" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="label">{t('invoices.notes')}</label>
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <button className="btn-primary w-full" disabled={create.isPending} onClick={submit}>{create.isPending ? t('common.loading') : t('invoices.create')}</button>
        </div>
      </Modal>
    </div>
  );
}
