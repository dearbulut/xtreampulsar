'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Modal, Field, inputCls, selectCls } from '@/components/ui/modal';
import { ArrowLeft, Copy, Check, Pencil, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  notes?: string;
  status: string;
  source?: string;
  createdAt: string;
  licenses: Array<{ id: string; key: string; plan: string; status: string; maxUsers: number; maxServers: number; serverDomain?: string; expiresAt?: string }>;
  tickets: Array<{ id: string; ticketNo: string; subject: string; status: string; priority: string; createdAt: string }>;
  invoices: Array<{ id: string; invoiceNo: string; amount: number; currency: string; status: string; dueAt?: string; createdAt: string }>;
}

type Tab = 'general' | 'licenses' | 'tickets' | 'invoices';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'general', label: 'Genel Bilgi' },
  { key: 'licenses', label: 'Lisanslar' },
  { key: 'tickets', label: 'Destek Talepleri' },
  { key: 'invoices', label: 'Faturalar' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  TRIAL: 'bg-blue-500/10 text-blue-400',
  SUSPENDED: 'bg-orange-500/10 text-orange-400',
  EXPIRED: 'bg-gray-700 text-gray-400',
  CHURNED: 'bg-red-500/10 text-red-400',
  OPEN: 'bg-yellow-500/10 text-yellow-400',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
  CLOSED: 'bg-gray-700 text-gray-400',
  PAID: 'bg-green-500/10 text-green-400',
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  CANCELLED: 'bg-gray-700 text-gray-400',
  OVERDUE: 'bg-red-500/10 text-red-400',
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', company: '', country: '', notes: '', status: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    controlApi.customers.get(id)
      .then((res) => {
        const c = res.data.data ?? res.data;
        setCustomer(c);
        setEditForm({
          name: c.name ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          company: c.company ?? '',
          country: c.country ?? '',
          notes: c.notes ?? '',
          status: c.status ?? 'ACTIVE',
        });
      })
      .catch(() => router.push('/customers'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function handleEditField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    setSaving(true);
    try {
      await controlApi.customers.update(id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined,
        company: editForm.company.trim() || undefined,
        country: editForm.country.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
        status: editForm.status,
      });
      setEditOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={customer?.name ?? 'Müşteri Detayı'} />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="flex items-center justify-between">
            <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
              <ArrowLeft size={14} /> Müşteriler
            </Link>
            {customer && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil size={13} /> Düzenle
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">Yükleniyor…</div>
          ) : customer ? (
            <>
              {/* Tab bar */}
              <div className="flex gap-1 border-b border-gray-800">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.key
                        ? 'border-brand-500 text-white'
                        : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                    {tab.key === 'licenses' && customer.licenses.length > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">{customer.licenses.length}</span>
                    )}
                    {tab.key === 'tickets' && customer.tickets.length > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">{customer.tickets.length}</span>
                    )}
                    {tab.key === 'invoices' && customer.invoices.length > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">{customer.invoices.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Genel Bilgi */}
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white mb-1">Profil</h2>
                    {([
                      { label: 'Ad Soyad', value: customer.name },
                      { label: 'E-posta', value: customer.email },
                      { label: 'Telefon', value: customer.phone },
                      { label: 'Şirket', value: customer.company },
                      { label: 'Ülke', value: customer.country },
                      { label: 'Kaynak', value: customer.source },
                      { label: 'Kayıt Tarihi', value: new Date(customer.createdAt).toLocaleDateString('tr-TR') },
                    ] as Array<{ label: string; value?: string }>).filter((r) => r.value).map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm border-b border-gray-800/60 pb-2 last:border-0">
                        <span className="text-gray-500">{label}</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Durum</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[customer.status] ?? 'bg-gray-700 text-gray-400'}`}>{customer.status}</span>
                    </div>
                  </div>
                  {customer.notes && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                      <p className="text-xs text-gray-500 mb-2">Notlar</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{customer.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Lisanslar */}
              {activeTab === 'licenses' && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Anahtar</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Sunucu</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Bitiş</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {customer.licenses.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Lisans yok</td></tr>
                      ) : customer.licenses.map((l) => (
                        <tr key={l.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">{l.key}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{l.plan}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{l.serverDomain ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('tr-TR') : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status] ?? 'bg-gray-700 text-gray-400'}`}>{l.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => copyKey(l.key)}
                              className="p-1 text-gray-500 hover:text-white transition-colors"
                              title="Anahtarı kopyala"
                            >
                              {copiedKey === l.key ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Destek Talepleri */}
              {activeTab === 'tickets' && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">No</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Konu</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Öncelik</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.tickets.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Destek talebi yok</td></tr>
                      ) : customer.tickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => router.push(`/tickets/${t.id}`)}
                          className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 cursor-pointer"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticketNo}</td>
                          <td className="px-4 py-3 text-white">{t.subject}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{t.priority}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status] ?? 'bg-gray-700 text-gray-400'}`}>{t.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Faturalar */}
              {activeTab === 'invoices' && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Fatura No</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Tutar</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Vade</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.invoices.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Fatura yok</td></tr>
                      ) : customer.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">{inv.invoiceNo}</td>
                          <td className="px-4 py-3 text-white font-medium">{inv.amount} {inv.currency}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString('tr-TR') : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] ?? 'bg-gray-700 text-gray-400'}`}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString('tr-TR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Müşteriyi Düzenle">
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Ad Soyad" required>
            <input name="name" value={editForm.name} onChange={handleEditField} className={inputCls} required />
          </Field>
          <Field label="E-posta" required>
            <input name="email" type="email" value={editForm.email} onChange={handleEditField} className={inputCls} required />
          </Field>
          <Field label="Telefon">
            <input name="phone" value={editForm.phone} onChange={handleEditField} className={inputCls} />
          </Field>
          <Field label="Şirket">
            <input name="company" value={editForm.company} onChange={handleEditField} className={inputCls} />
          </Field>
          <Field label="Ülke">
            <input name="country" value={editForm.country} onChange={handleEditField} className={inputCls} />
          </Field>
          <Field label="Durum">
            <select name="status" value={editForm.status} onChange={handleEditField} className={selectCls}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="CHURNED">CHURNED</option>
            </select>
          </Field>
          <Field label="Notlar">
            <textarea name="notes" value={editForm.notes} onChange={handleEditField} rows={2} className={inputCls + ' resize-none'} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
              İptal
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg transition-colors">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Kaydet
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
