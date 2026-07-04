'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { ArrowLeft, Send, XCircle } from 'lucide-react';

interface Message { id: string; content: string; isStaff: boolean; authorName?: string; createdAt: string }
interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  messages: Message[];
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

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    controlApi.tickets.get(id)
      .then((res) => {
        const t = res.data.data ?? res.data;
        setTicket(t);
      })
      .catch(() => router.push('/tickets'))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [load, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await controlApi.tickets.reply(id, reply);
      setReply('');
      load();
    } finally {
      setSending(false);
    }
  }

  async function handleClose() {
    if (!confirm('Bu talebi kapatmak istiyor musunuz?')) return;
    await controlApi.tickets.close(id);
    load();
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={ticket ? `#${ticket.ticketNo}` : 'Destek Talebi'} />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
              <ArrowLeft size={14} /> Talepler
            </Link>
            {ticket?.status === 'OPEN' || ticket?.status === 'IN_PROGRESS' ? (
              <button onClick={handleClose} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">
                <XCircle size={14} /> Kapat
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">Yükleniyor…</div>
          ) : ticket ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
              {/* Info sidebar */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3 h-fit">
                <h2 className="text-sm font-semibold text-white">Detaylar</h2>
                {([
                  { label: 'Müşteri', value: ticket.customer.name },
                  { label: 'E-posta', value: ticket.customer.email },
                  { label: 'Konu', value: ticket.subject },
                  { label: 'Kategori', value: ticket.category },
                  { label: 'Tarih', value: new Date(ticket.createdAt).toLocaleDateString('tr-TR') },
                ] as Array<{ label: string; value: string }>).map(({ label, value }) => (
                  <div key={label} className="text-sm">
                    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                    <p className="text-gray-200 break-all">{value}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-800">
                  <span className="text-xs text-gray-500">Öncelik</span>
                  <span className={`text-xs font-semibold ${PRIORITY_COLOR[ticket.priority] ?? 'text-gray-400'}`}>{ticket.priority}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs text-gray-500">Durum</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[ticket.status] ?? 'bg-gray-700 text-gray-400'}`}>{ticket.status}</span>
                </div>
                <div className="pt-1">
                  <Link href={`/customers/${ticket.customer.id}`} className="text-xs text-brand-400 hover:text-brand-300">
                    Müşteri profiline git →
                  </Link>
                </div>
              </div>

              {/* Chat */}
              <div className="lg:col-span-3 flex flex-col gap-3">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 space-y-3 overflow-y-auto" style={{ maxHeight: 420 }}>
                  {(Array.isArray(ticket.messages) ? ticket.messages : []).map((m) => (
                    <div key={m.id} className={`flex ${m.isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-4 py-3 ${m.isStaff ? 'bg-brand-600/20 border border-brand-600/30' : 'bg-gray-800 border border-gray-700'}`}>
                        <p className="text-xs text-gray-500 mb-1">
                          {m.authorName ?? (m.isStaff ? 'Admin' : ticket.customer.name)} · {new Date(m.createdAt).toLocaleString('tr-TR')}
                        </p>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                {ticket.status !== 'CLOSED' && (
                  <form onSubmit={handleReply} className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Yanıt yazın…"
                      rows={2}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleReply(e as unknown as React.FormEvent);
                      }}
                    />
                    <button
                      type="submit"
                      disabled={sending || !reply.trim()}
                      className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
