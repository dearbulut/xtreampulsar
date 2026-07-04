'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Search, Plus, ChevronRight } from 'lucide-react';

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

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback((q: string) => {
    setLoading(true);
    controlApi.customers.list({ search: q || undefined })
      .then((res) => {
        const d = res.data.data ?? res.data;
        setCustomers(d.data);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load('');
  }, [router, load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 400);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title="Müşteriler" />
        <main className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim veya e-posta ara..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
            <span className="text-xs text-gray-500">{total} müşteri</span>
            <button className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
              <Plus size={14} /> Yeni Müşteri
            </button>
          </div>
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Yükleniyor...</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600">Müşteri bulunamadı</td></tr>
                ) : customers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{c.company ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{c._count.licenses}</td>
                    <td className="px-4 py-3 text-gray-400">{c._count.tickets}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="text-gray-500 hover:text-white">
                        <ChevronRight size={16} />
                      </Link>
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
