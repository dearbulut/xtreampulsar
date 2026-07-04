'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Modal, Field, inputCls, selectCls } from '@/components/ui/modal';
import { CheckCircle, XCircle, Plus, Loader2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNo: string;
  amount: number;
  currency: string;
  status: string;
  plan?: string;
  period?: string;
  paidAt?: string;
  dueAt?: string;
  createdAt: string;
  customer: { id: string; name: string; email: string };
}

interface CustomerOption { id: string; name: string; email: string }

const STATUS_FILTER = [
  { value: undefined, label: 'Tümü' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'PAID', label: 'Ödendi' },
  { value: 'CANCELLED', label: 'İptal' },
  { value: 'OVERDUE', label: 'Gecikmiş' },
];

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-green-500/10 text-green-400',
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  CANCELLED: 'bg-gray-700 text-gray-400',
  OVERDUE: 'bg-red-500/10 text-red-400',
};

const EMPTY_FORM = { customerId: '', amount: '', currency: 'EUR', plan: '', period: '', dueAt: '' };

function isOverdue(inv: Invoice) {
  return inv.status === 'PENDING' && !!inv.dueAt && new Date(inv.dueAt) < new Date();
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    const apiStatus = filterStatus === 'OVERDUE' ? 'PENDING' : filterStatus;
    controlApi.invoices.list({ status: apiStatus })
      .then((res) => {
        const d = res.data.data ?? res.data;
        let items: Invoice[] = Array.isArray(d.data) ? d.data : [];
        if (filterStatus === 'OVERDUE') {
          items = items.filter(isOverdue);
        }
        setInvoices(items);
        setTotal(items.length);
        setTotalAmount(items.reduce((sum, inv) => sum + (inv.amount ?? 0), 0));
      })
      .catch(() => { setInvoices([]); setTotal(0); setTotalAmount(0); })
      .finally(() => setLoading(false));
  }, [filterStatus]);

  async function handleMarkPaid(id: string) {
    await controlApi.invoices.markPaid(id);
    setFilterStatus((s) => s);
  }

  async function handleCancel(id: string) {
    if (!confirm('Bu faturayı iptal etmek istiyor musunuz?')) return;
    await controlApi.invoices.cancel(id);
    setFilterStatus((s) => s);
  }

  async function openModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
    if (customers.length === 0) {
      const res = await controlApi.customers.list({ limit: 200 });
      const d = res.data.data ?? res.data;
      setCustomers(Array.isArray(d.data) ? d.data : []);
    }
  }

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customerId || !form.amount) return;
    setSaving(true);
    try {
      await controlApi.invoices.create({
        customerId: form.customerId,
        amount: parseFloat(form.amount),
        currency: form.currency,
        plan: form.plan.trim() || undefined,
        period: form.period.trim() || undefined,
        dueAt: form.dueAt || undefined,
      });
      setModalOpen(false);
      setFilterStatus((s) => s);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Faturalar" />
        <main className="flex-1 overflow-y-auto p-6">

          <div className="flex flex-wrap items-center gap-2 mb-5">
            {STATUS_FILTER.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setFilterStatus(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${filterStatus === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3">
              {totalAmount > 0 && (
                <span className="text-sm text-gray-400">
                  Toplam: <span className="text-white font-medium">{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {invoices[0]?.currency ?? 'EUR'}</span>
                </span>
              )}
              <button
                onClick={openModal}
                className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={14} /> Yeni Fatura
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Fatura No</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Tutar</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Vade</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">Yükleniyor…</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">Fatura bulunamadı</td></tr>
                ) : invoices.map((inv) => {
                  const overdue = isOverdue(inv);
                  const statusKey = overdue ? 'OVERDUE' : inv.status;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/customers/${inv.customer.id}`)}
                      className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{inv.invoiceNo}</td>
                      <td className="px-4 py-3">
                        <p className="text-white">{inv.customer.name}</p>
                        <p className="text-xs text-gray-500">{inv.customer.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{inv.plan ?? '—'}{inv.period ? ` / ${inv.period}` : ''}</td>
                      <td className="px-4 py-3 text-white font-medium">{inv.amount} {inv.currency}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString('tr-TR') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[statusKey] ?? 'bg-gray-700 text-gray-400'}`}>
                          {statusKey}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {inv.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleMarkPaid(inv.id)} className="p-1 text-gray-500 hover:text-green-400 transition-colors" title="Ödendi işaretle">
                                <CheckCircle size={14} />
                              </button>
                              <button onClick={() => handleCancel(inv.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="İptal et">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Fatura">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Müşteri" required>
            <select name="customerId" value={form.customerId} onChange={handleField} className={selectCls} required>
              <option value="">Müşteri seçin…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tutar" required>
              <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleField} placeholder="0.00" className={inputCls} required />
            </Field>
            <Field label="Para Birimi">
              <select name="currency" value={form.currency} onChange={handleField} className={selectCls}>
                <option>EUR</option>
                <option>USD</option>
                <option>TRY</option>
              </select>
            </Field>
          </div>
          <Field label="Plan">
            <input name="plan" value={form.plan} onChange={handleField} placeholder="PRO" className={inputCls} />
          </Field>
          <Field label="Dönem">
            <input name="period" value={form.period} onChange={handleField} placeholder="2026-06" className={inputCls} />
          </Field>
          <Field label="Son Ödeme Tarihi">
            <input name="dueAt" type="date" value={form.dueAt} onChange={handleField} className={inputCls} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">İptal</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Oluştur
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
