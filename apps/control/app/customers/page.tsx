'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Modal, Field, inputCls, selectCls } from '@/components/ui/modal';
import { Search, Plus, ChevronRight, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  country?: string;
  status: string;
  createdAt: string;
  _count: { licenses: number; tickets: number };
}

const STATUS_TABS = [
  { value: undefined, label: 'Tümü' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'SUSPENDED', label: 'Askıda' },
  { value: 'CHURNED', label: 'Ayrıldı' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  SUSPENDED: 'bg-orange-500/10 text-orange-400',
  CHURNED: 'bg-red-500/10 text-red-400',
};

const EMPTY_FORM = { name: '', email: '', phone: '', company: '', country: '', notes: '' };

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback((q: string, st: string | undefined) => {
    setLoading(true);
    controlApi.customers.list({ search: q || undefined, status: st })
      .then((res) => {
        const d = res.data.data ?? res.data;
        setCustomers(Array.isArray(d.data) ? d.data : []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        setCustomers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load('', undefined);
  }, [router, load]);

  useEffect(() => {
    const t = setTimeout(() => load(search, filterStatus), 350);
    return () => clearTimeout(t);
  }, [search, filterStatus, load]);

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      await controlApi.customers.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        country: form.country.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load(search, filterStatus);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Müşteriler" />
        <main className="flex-1 overflow-y-auto p-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {STATUS_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setFilterStatus(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${filterStatus === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
            <div className="relative ml-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim veya e-posta..."
                className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600 w-56"
              />
            </div>
            <span className="text-xs text-gray-500 ml-1">{total} müşteri</span>
            <button
              onClick={() => setModalOpen(true)}
              className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> Yeni Müşteri
            </button>
          </div>

          {/* Table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Şirket</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Lisans</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Destek</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Yükleniyor…</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600">Müşteri bulunamadı</td></tr>
                ) : customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/customers/${c.id}`)}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{c.company ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{c._count?.licenses ?? 0}</td>
                    <td className="px-4 py-3 text-gray-400">{c._count?.tickets ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status] ?? 'bg-gray-700 text-gray-400'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* New customer modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Müşteri">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Ad Soyad" required>
            <input name="name" value={form.name} onChange={handleField} placeholder="Ahmet Yılmaz" className={inputCls} required />
          </Field>
          <Field label="E-posta" required>
            <input name="email" type="email" value={form.email} onChange={handleField} placeholder="ahmet@example.com" className={inputCls} required />
          </Field>
          <Field label="Telefon">
            <input name="phone" value={form.phone} onChange={handleField} placeholder="+90 555 000 0000" className={inputCls} />
          </Field>
          <Field label="Şirket">
            <input name="company" value={form.company} onChange={handleField} placeholder="Şirket Adı" className={inputCls} />
          </Field>
          <Field label="Ülke">
            <input name="country" value={form.country} onChange={handleField} placeholder="Türkiye" className={inputCls} />
          </Field>
          <Field label="Notlar">
            <textarea name="notes" value={form.notes} onChange={handleField} rows={2} placeholder="Ek notlar…" className={inputCls + ' resize-none'} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
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
