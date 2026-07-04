'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { ChevronRight, Globe, Monitor } from 'lucide-react';

interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  panelUrl?: string;
  serverIp?: string;
  createdAt: string;
  customer: { name: string; email: string };
  _count?: { messages: number };
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};
const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-yellow-500/10 text-yellow-400',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
  RESOLVED: 'bg-green-500/10 text-green-400',
  CLOSED: 'bg-gray-700 text-gray-400',
};

const STATUS_TABS = [
  { value: undefined, label: 'Tümü' },
  { value: 'OPEN', label: 'Açık' },
  { value: 'IN_PROGRESS', label: 'İşlemde' },
  { value: 'RESOLVED', label: 'Çözüldü' },
  { value: 'CLOSED', label: 'Kapalı' },
];
const PRIORITY_TABS = [
  { value: undefined, label: 'Tüm Öncelik' },
  { value: 'URGENT', label: 'Acil' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'LOW', label: 'Düşük' },
];

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    controlApi.tickets.list({ status })
      .then((res) => {
        const d = res.data.data ?? res.data;
        let items: Ticket[] = Array.isArray(d.data) ? d.data : [];
        if (priority) items = items.filter((t) => t.priority === priority);
        setTickets(items);
        setTotal(items.length);
      })
      .catch(() => { setTickets([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [status, priority]);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Destek Talepleri" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {STATUS_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setStatus(tab.value)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${status === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {PRIORITY_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                onClick={() => setPriority(tab.value)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${priority === tab.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
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
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">No</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Konu</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Panel</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Öncelik</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Mesaj</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Yükleniyor…</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Talep bulunamadı</td></tr>
                ) : tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticketNo}</td>
                    <td className="px-4 py-3 text-white max-w-[200px] truncate">{t.subject}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-300">{t.customer?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{t.customer?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.panelUrl ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe size={11} />
                          <span className="truncate max-w-[100px]">{t.panelUrl.replace(/^https?:\/\//, '')}</span>
                        </div>
                      ) : t.serverIp ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Monitor size={11} />
                          <span>{t.serverIp}</span>
                        </div>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs font-semibold ${PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>{t.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status] ?? 'bg-gray-700 text-gray-400'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t._count?.messages ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600"><ChevronRight size={15} /></td>
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
