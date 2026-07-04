'use client';
import { useEffect, useState, useRef } from 'react';
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

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function load() {
    controlApi.tickets.get(id)
      .then((res) => setTicket(res.data.data ?? res.data))
      .catch(() => router.push('/tickets'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [id, router]);

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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title={ticket ? `#${ticket.ticketNo}` : 'Destek Talebi'} />
        <main className="flex-1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Link href="/tickets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
              <ArrowLeft size={14} /> Talepler
            </Link>
            {ticket?.status === 'OPEN' && (
              <button onClick={handleClose} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg">
                <XCircle size={14} /> Talebi Kapat
              </button>
            )}
          </div>
          {loading ? (
            <div className="text-gray-600 text-sm">Yükleniyor...</div>
          ) : ticket ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3 h-fit">
                <h2 className="text-sm font-medium text-white">Bilgiler</h2>
                {[
                  { label: 'Müşteri', value: ticket.customer.name },
                  { label: 'E-posta', value: ticket.customer.email },
                  { label: 'Konu', value: ticket.subject },
                  { label: 'Öncelik', value: ticket.priority },
                  { label: 'Kategori', value: ticket.category },
                  { label: 'Durum', value: ticket.status },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 text-sm">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <span className="text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              <div className="lg:col-span-3 flex flex-col gap-3">
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 space-y-3 max-h-[500px] overflow-y-auto">
                  {ticket.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-4 py-3 ${m.isStaff ? 'bg-brand-600/20 border border-brand-600/30' : 'bg-gray-800 border border-gray-700'}`}>
                        <p className="text-xs text-gray-500 mb-1">{m.authorName ?? (m.isStaff ? 'Admin' : ticket.customer.name)} · {new Date(m.createdAt).toLocaleString('tr-TR')}</p>
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
                      placeholder="Yanıt yazın..."
                      rows={2}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
                    />
                    <button type="submit" disabled={sending || !reply.trim()} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl transition-colors">
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
