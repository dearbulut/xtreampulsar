'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Modal, Field, inputCls, selectCls } from '@/components/ui/modal';
import { Plus, Pause, Play, Trash2, Search, Copy, Check, Loader2 } from 'lucide-react';

interface License {
  id: string;
  key: string;
  plan: string;
  status: string;
  maxUsers: number;
  maxServers: number;
  serverIp?: string;
  serverDomain?: string;
  expiresAt?: string;
  customer: { id: string; name: string; email: string };
}

interface CustomerOption { id: string; name: string; email: string }

const PLANS = ['STARTER', 'PRO', 'BUSINESS', 'WHITE_LABEL'];
const STATUS_TABS = [
  { value: undefined, label: 'Tümü' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'TRIAL', label: 'Deneme' },
  { value: 'SUSPENDED', label: 'Askıda' },
  { value: 'EXPIRED', label: 'Süresi Doldu' },
];
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  TRIAL: 'bg-blue-500/10 text-blue-400',
  SUSPENDED: 'bg-orange-500/10 text-orange-400',
  EXPIRED: 'bg-gray-700 text-gray-400',
};

const EMPTY_FORM = {
  customerId: '',
  plan: 'STARTER',
  maxUsers: '5',
  maxServers: '1',
  serverDomain: '',
  expiresAt: '',
};

export default function LicensesPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback((q: string, plan: string, st: string | undefined) => {
    setLoading(true);
    controlApi.licenses.list({ search: q || undefined, plan: plan || undefined, status: st })
      .then((res) => {
        const d = res.data.data ?? res.data;
        setLicenses(Array.isArray(d.data) ? d.data : []);
        setTotal(d.total ?? 0);
      })
      .catch(() => { setLicenses([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load('', '', undefined);
  }, [router, load]);

  useEffect(() => {
    const t = setTimeout(() => load(search, filterPlan, filterStatus), 350);
    return () => clearTimeout(t);
  }, [search, filterPlan, filterStatus, load]);

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
    if (!form.customerId) return;
    setSaving(true);
    try {
      await controlApi.licenses.create({
        customerId: form.customerId,
        plan: form.plan,
        maxUsers: parseInt(form.maxUsers, 10) || 5,
        maxServers: parseInt(form.maxServers, 10) || 1,
        serverDomain: form.serverDomain.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      setModalOpen(false);
      load(search, filterPlan, filterStatus);
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspend(id: string) {
    await controlApi.licenses.suspend(id);
    load(search, filterPlan, filterStatus);
  }
  async function handleActivate(id: string) {
    await controlApi.licenses.activate(id);
    load(search, filterPlan, filterStatus);
  }
  async function handleDelete(id: string) {
    if (!confirm('Bu lisansı silmek istediğinizden emin misiniz?')) return;
    await controlApi.licenses.delete(id);
    load(search, filterPlan, filterStatus);
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Lisanslar" />
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
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            >
              <option value="">Tüm Planlar</option>
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Anahtar, IP veya domain..."
                className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600 w-56"
              />
            </div>
            <span className="text-xs text-gray-500 ml-1">{total} lisans</span>
            <button
              onClick={openModal}
              className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> Yeni Lisans
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Anahtar</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Sunucu</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Bitiş</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">Yükleniyor…</td></tr>
                ) : licenses.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">Lisans bulunamadı</td></tr>
                ) : licenses.map((l) => (
                  <tr key={l.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-300 truncate max-w-[120px]">{l.key}</span>
                        <button onClick={() => copyKey(l.key)} className="text-gray-600 hover:text-white transition-colors shrink-0">
                          {copiedKey === l.key ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{l.customer.name}</p>
                      <p className="text-xs text-gray-500">{l.customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.plan}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.serverDomain ?? l.serverIp ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('tr-TR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status] ?? 'bg-gray-700 text-gray-400'}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {l.status === 'SUSPENDED' ? (
                          <button onClick={() => handleActivate(l.id)} className="p-1 text-gray-500 hover:text-green-400 transition-colors" title="Aktifleştir"><Play size={14} /></button>
                        ) : (
                          <button onClick={() => handleSuspend(l.id)} className="p-1 text-gray-500 hover:text-yellow-400 transition-colors" title="Askıya Al"><Pause size={14} /></button>
                        )}
                        <button onClick={() => handleDelete(l.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Sil"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Lisans">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Müşteri" required>
            <select name="customerId" value={form.customerId} onChange={handleField} className={selectCls} required>
              <option value="">Müşteri seçin…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            </select>
          </Field>
          <Field label="Plan" required>
            <select name="plan" value={form.plan} onChange={handleField} className={selectCls}>
              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Maks. Kullanıcı">
              <input name="maxUsers" type="number" min="1" value={form.maxUsers} onChange={handleField} className={inputCls} />
            </Field>
            <Field label="Maks. Sunucu">
              <input name="maxServers" type="number" min="1" value={form.maxServers} onChange={handleField} className={inputCls} />
            </Field>
          </div>
          <Field label="Sunucu Domain">
            <input name="serverDomain" value={form.serverDomain} onChange={handleField} placeholder="example.com" className={inputCls} />
          </Field>
          <Field label="Bitiş Tarihi">
            <input name="expiresAt" type="date" value={form.expiresAt} onChange={handleField} className={inputCls} />
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
