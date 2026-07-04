'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { ChevronRight } from 'lucide-react';

interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  customer: { name: string; email: string };
  _count: { messages: number };
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};

const FILTER_TABS = [
  { value: undefined, label: 'Tümü' },
  { value: 'OPEN', label: 'Açık' },
  { value: 'IN_PROGRESS', label: 'İşlemde' },
  { value: 'CLOSED', label: 'Kapalı' },
];

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    controlApi.tickets.list({ status })
      .then((res) => {
        const d = res.data.data ?? res.data;
        setTickets(d.data);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title="Destek Talepleri" />
        <main className="flex-1 p-6">
          <div className="flex items-center gap-2 mb-5">
            {FILTER_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setStatus(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${status === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-500">{total} talep</span>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Talep No</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Konu</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Öncelik</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Mesajlar</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Yükleniyor...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Talep bulunamadı</td></tr>
                ) : tickets.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.ticketNo}</td>
                    <td className="px-4 py-3 text-white">{t.subject}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300">{t.customer.name}</p>
                      <p className="text-xs text-gray-500">{t.customer.email}</p>
                    </td>
                    <td className={`px-4 py-3 text-xs font-medium ${PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>{t.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'OPEN' ? 'bg-yellow-500/10 text-yellow-400' : t.status === 'CLOSED' ? 'bg-gray-700 text-gray-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t._count.messages}</td>
                    <td className="px-4 py-3">
                      <Link href={`/tickets/${t.id}`} className="text-gray-500 hover:text-white">
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
