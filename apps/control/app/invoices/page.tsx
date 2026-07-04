'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { CheckCircle, XCircle, Plus } from 'lucide-react';

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
  customer: { name: string; email: string };
}

const STATUS_FILTER = [
  { value: undefined, label: 'Tümü' },
  { value: 'PENDING', label: 'Bekleyen' },
  { value: 'PAID', label: 'Ödendi' },
  { value: 'CANCELLED', label: 'İptal' },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    controlApi.invoices.list({ status })
      .then((res) => {
        const d = res.data.data ?? res.data;
        setInvoices(d.data);
        setTotal(d.total);
        setTotalAmount(d.totalAmount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
  }, [router]);

  useEffect(() => { load(); }, [status]);

  async function handleMarkPaid(id: string) {
    await controlApi.invoices.markPaid(id);
    load();
  }

  async function handleCancel(id: string) {
    if (!confirm('Bu faturayı iptal etmek istiyor musunuz?')) return;
    await controlApi.invoices.cancel(id);
    load();
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title="Faturalar" />
        <main className="flex-1 p-6">
          <div className="flex items-center gap-2 mb-5">
            {STATUS_FILTER.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setStatus(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${status === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3">
              {totalAmount > 0 && (
                <span className="text-sm text-gray-400">
                  Toplam: <span className="text-white font-medium">{totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: invoices[0]?.currency ?? 'EUR' })}</span>
                </span>
              )}
              <button className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Yükleniyor...</td></tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Fatura bulunamadı</td></tr>
                ) : invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{inv.invoiceNo}</td>
                    <td className="px-4 py-3">
                      <p className="text-white">{inv.customer.name}</p>
                      <p className="text-xs text-gray-500">{inv.customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{inv.plan ?? '—'}{inv.period ? ` / ${inv.period}` : ''}</td>
                    <td className="px-4 py-3 text-white font-medium">{inv.amount} {inv.currency}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString('tr-TR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'PAID' ? 'bg-green-500/10 text-green-400' : inv.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {inv.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleMarkPaid(inv.id)} className="p-1 text-gray-500 hover:text-green-400 transition-colors" title="Ödendi İşaretle">
                              <CheckCircle size={14} />
                            </button>
                            <button onClick={() => handleCancel(inv.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="İptal Et">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
