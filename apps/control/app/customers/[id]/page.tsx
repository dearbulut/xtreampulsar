'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { ArrowLeft, Key, MessageSquare, FileText } from 'lucide-react';

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
  licenses: Array<{ id: string; key: string; plan: string; status: string; expiresAt?: string }>;
  tickets: Array<{ id: string; ticketNo: string; subject: string; status: string; priority: string; createdAt: string }>;
  invoices: Array<{ id: string; invoiceNo: string; amount: number; currency: string; status: string; createdAt: string }>;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    controlApi.customers.get(id)
      .then((res) => setCustomer(res.data.data ?? res.data))
      .catch(() => router.push('/customers'))
      .finally(() => setLoading(false));
  }, [id, router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title={customer?.name ?? 'Müşteri Detayı'} />
        <main className="flex-1 p-6 space-y-6">
          <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
            <ArrowLeft size={14} /> Müşteriler
          </Link>
          {loading ? (
            <div className="text-gray-600 text-sm">Yükleniyor...</div>
          ) : customer ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
                  <h2 className="text-sm font-medium text-white">Profil</h2>
                  {[
                    { label: 'Ad', value: customer.name },
                    { label: 'E-posta', value: customer.email },
                    { label: 'Telefon', value: customer.phone },
                    { label: 'Şirket', value: customer.company },
                    { label: 'Ülke', value: customer.country },
                    { label: 'Kaynak', value: customer.source },
                  ].map(({ label, value }) => value ? (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ) : null)}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Durum</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${customer.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{customer.status}</span>
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Key size={14} className="text-purple-400" />
                      <h3 className="text-sm font-medium text-white">Lisanslar</h3>
                    </div>
                    {customer.licenses.length === 0 ? (
                      <p className="text-sm text-gray-600">Lisans yok</p>
                    ) : (
                      <div className="space-y-2">
                        {customer.licenses.map((l) => (
                          <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 text-sm">
                            <div>
                              <p className="text-white font-mono text-xs">{l.key}</p>
                              <p className="text-gray-500 text-xs">{l.plan}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : l.status === 'TRIAL' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>{l.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={14} className="text-yellow-400" />
                        <h3 className="text-sm font-medium text-white">Destek Talepleri</h3>
                      </div>
                      {customer.tickets.length === 0 ? <p className="text-sm text-gray-600">Talep yok</p> : (
                        customer.tickets.slice(0, 5).map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-800 last:border-0">
                            <div>
                              <p className="text-white text-xs">{t.subject}</p>
                              <p className="text-gray-500 text-xs">{t.ticketNo}</p>
                            </div>
                            <span className={`text-xs ${t.status === 'OPEN' ? 'text-yellow-400' : 'text-gray-500'}`}>{t.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} className="text-green-400" />
                        <h3 className="text-sm font-medium text-white">Faturalar</h3>
                      </div>
                      {customer.invoices.length === 0 ? <p className="text-sm text-gray-600">Fatura yok</p> : (
                        customer.invoices.slice(0, 5).map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between py-1.5 text-sm border-b border-gray-800 last:border-0">
                            <div>
                              <p className="text-white text-xs">{inv.invoiceNo}</p>
                              <p className="text-gray-500 text-xs">{inv.amount} {inv.currency}</p>
                            </div>
                            <span className={`text-xs ${inv.status === 'PAID' ? 'text-green-400' : inv.status === 'PENDING' ? 'text-yellow-400' : 'text-gray-500'}`}>{inv.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {customer.notes && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <p className="text-xs text-gray-500 mb-1">Notlar</p>
                  <p className="text-sm text-gray-300">{customer.notes}</p>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
