'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Users, Key, MessageSquare, FileText, TrendingUp, Clock } from 'lucide-react';

interface Stats {
  counts: { customers: number; licenses: number; tickets: number; invoices: number };
  openTickets: number;
  pendingRevenue: number;
  recentCustomers: Array<{ id: string; name: string; email: string; status: string; createdAt: string }>;
  recentTickets: Array<{ id: string; ticketNo: string; subject: string; status: string; priority: string; customer: { name: string }; createdAt: string }>;
}

const STAT_CARDS = [
  { key: 'customers' as const, label: 'Toplam Müşteri', icon: Users, color: 'text-blue-400' },
  { key: 'licenses' as const, label: 'Aktif Lisans', icon: Key, color: 'text-purple-400' },
  { key: 'tickets' as const, label: 'Destek Talebi', icon: MessageSquare, color: 'text-yellow-400' },
  { key: 'invoices' as const, label: 'Fatura', icon: FileText, color: 'text-green-400' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    controlApi.dashboard.stats()
      .then((res) => setStats(res.data.data ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title="Dashboard" />
        <main className="flex-1 p-6 space-y-6">
          {loading ? (
            <div className="text-gray-500 text-sm">Yükleniyor...</div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">{label}</span>
                      <Icon size={16} className={color} />
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.counts[key].toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={15} className="text-gray-400" />
                    <h2 className="text-sm font-medium text-white">Son Müşteriler</h2>
                  </div>
                  <div className="space-y-2">
                    {stats.recentCustomers.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <p className="text-sm text-white">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                    {stats.recentCustomers.length === 0 && <p className="text-sm text-gray-600">Henüz müşteri yok</p>}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={15} className="text-gray-400" />
                    <h2 className="text-sm font-medium text-white">Son Destek Talepleri</h2>
                    {stats.openTickets > 0 && (
                      <span className="ml-auto text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{stats.openTickets} açık</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {stats.recentTickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <p className="text-sm text-white">{t.subject}</p>
                          <p className="text-xs text-gray-500">{t.customer.name} · {t.ticketNo}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'OPEN' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                    {stats.recentTickets.length === 0 && <p className="text-sm text-gray-600">Destek talebi yok</p>}
                  </div>
                </div>
              </div>
              {stats.pendingRevenue > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                  <FileText size={16} className="text-yellow-400" />
                  <p className="text-sm text-yellow-300">
                    <span className="font-semibold">{stats.pendingRevenue.toLocaleString('tr-TR', { style: 'currency', currency: 'EUR' })}</span> tutarında bekleyen fatura mevcut
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-sm">Veriler yüklenemedi</div>
          )}
        </main>
      </div>
    </div>
  );
}
