'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import {
  Users, Key, Ticket, FileText,
  TrendingUp, ShieldCheck, AlertCircle, ChevronRight, Clock,
} from 'lucide-react';

const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), { ssr: false });

type DashboardStats = {
  counts: { customers: number; licenses: number; tickets: number; invoices: number };
  openTickets: number;
  pendingRevenue: number;
  activeLicenses: number;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  recentCustomers: Array<{ id: string; name: string; email: string; status: string; createdAt: string }>;
  recentTickets: Array<{ id: string; subject: string; status: string; priority: string; createdAt: string; customer: { name: string } }>;
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};
const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-yellow-400/10 text-yellow-400',
  IN_PROGRESS: 'bg-blue-400/10 text-blue-400',
  RESOLVED: 'bg-green-400/10 text-green-400',
  CLOSED: 'bg-gray-700 text-gray-400',
  ACTIVE: 'bg-green-400/10 text-green-400',
  SUSPENDED: 'bg-orange-400/10 text-orange-400',
  CHURNED: 'bg-red-400/10 text-red-400',
};

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) router.replace('/login');
  }, [router]);

  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['control-dashboard'],
    queryFn: async () => {
      const res = await controlApi.dashboard.stats();
      return (res.data.data ?? res.data) as DashboardStats;
    },
    enabled: mounted,
  });

  const statCards = [
    { label: 'Müşteri', value: stats?.counts.customers ?? 0, icon: Users, color: 'text-purple-400' },
    { label: 'Lisans', value: stats?.counts.licenses ?? 0, icon: Key, color: 'text-blue-400' },
    { label: 'Destek Talebi', value: stats?.counts.tickets ?? 0, icon: Ticket, color: 'text-yellow-400' },
    { label: 'Fatura', value: stats?.counts.invoices ?? 0, icon: FileText, color: 'text-green-400' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Dashboard" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((c) => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">{c.label}</span>
                  <c.icon size={16} className={c.color} />
                </div>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? '—' : c.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Chart + health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-purple-400" />
                <span className="text-sm font-medium text-white">Son 6 Ay Gelir</span>
              </div>
              {isLoading ? (
                <div className="h-44 flex items-center justify-center text-gray-500 text-sm">Yükleniyor…</div>
              ) : (
                <RevenueChart data={stats?.monthlyRevenue ?? []} />
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-green-400" />
                <span className="text-sm font-medium text-white">Sistem Sağlığı</span>
              </div>
              <HealthBar
                label="Aktif Lisans"
                value={stats?.activeLicenses ?? 0}
                total={stats?.counts.licenses ?? 0}
                color="bg-green-500"
                loading={isLoading}
              />
              <HealthBar
                label="Açık Talep"
                value={stats?.openTickets ?? 0}
                total={stats?.counts.tickets ?? 0}
                color="bg-yellow-500"
                loading={isLoading}
              />
              {!isLoading && (stats?.pendingRevenue ?? 0) > 0 && (
                <div className="pt-3 border-t border-gray-800 flex items-center gap-2 text-yellow-400">
                  <AlertCircle size={13} />
                  <span className="text-xs font-medium">
                    Bekleyen: €{(stats?.pendingRevenue ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <span className="text-sm font-medium text-white">Son Müşteriler</span>
                <button onClick={() => router.push('/customers')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  Tümü <ChevronRight size={12} />
                </button>
              </div>
              {isLoading ? (
                <div className="p-6 text-center text-gray-500 text-sm">Yükleniyor…</div>
              ) : isError ? (
                <div className="p-6 text-center text-red-400 text-sm">Yüklenemedi</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {(Array.isArray(stats?.recentCustomers) ? stats.recentCustomers : []).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm text-white">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-700 text-gray-400'}`}>
                          {c.status}
                        </span>
                        <ChevronRight size={13} className="text-gray-600" />
                      </div>
                    </button>
                  ))}
                  {(stats?.recentCustomers ?? []).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-6">Kayıt yok</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <span className="text-sm font-medium text-white">Son Destek Talepleri</span>
                <button onClick={() => router.push('/tickets')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  Tümü <ChevronRight size={12} />
                </button>
              </div>
              {isLoading ? (
                <div className="p-6 text-center text-gray-500 text-sm">Yükleniyor…</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {(Array.isArray(stats?.recentTickets) ? stats.recentTickets : []).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{t.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={11} className="text-gray-500" />
                          <span className="text-xs text-gray-500">{t.customer?.name}</span>
                          <span className={`text-xs font-medium ${PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>{t.priority}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status] ?? 'bg-gray-700 text-gray-400'}`}>
                          {t.status}
                        </span>
                        <ChevronRight size={13} className="text-gray-600" />
                      </div>
                    </button>
                  ))}
                  {(stats?.recentTickets ?? []).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-6">Kayıt yok</p>
                  )}
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

function HealthBar({
  label, value, total, color, loading,
}: {
  label: string; value: number; total: number; color: string; loading: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{loading ? '—' : `${value} / ${total}`}</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
