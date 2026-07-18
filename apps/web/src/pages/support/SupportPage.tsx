import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/axios';
import {
  MessageSquare, Plus, X, Send, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';

interface Ticket {
  ticketId: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  lastMessage?: { content: string; isStaff: boolean; createdAt: string } | null;
}

interface Message {
  id: string;
  content: string;
  isStaff: boolean;
  authorName?: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  messages: Message[];
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  CLOSED: 'bg-gray-700 text-gray-400 border-gray-600',
};
const STATUS_KEY: Record<string, string> = {
  OPEN: 'support.statusOpen', IN_PROGRESS: 'support.statusInProgress', RESOLVED: 'support.statusResolved', CLOSED: 'support.statusClosed',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-gray-400', MEDIUM: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
};
const PRIORITY_KEY: Record<string, string> = {
  LOW: 'support.priorityLow', MEDIUM: 'support.priorityMedium', HIGH: 'support.priorityHigh', CRITICAL: 'support.priorityCritical',
};
const CATEGORY_KEY: Record<string, string> = {
  GENERAL: 'support.categoryGeneral', BILLING: 'support.categoryBilling', TECHNICAL: 'support.categoryTechnical', FEATURE: 'support.categoryFeature',
};

const EMPTY_FORM = { subject: '', message: '', category: 'TECHNICAL', priority: 'MEDIUM' };

export function SupportPage() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadTickets() {
    try {
      const res = await api.get('/support/tickets');
      const data = res.data?.data ?? res.data;
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await api.get(`/support/tickets/${id}`);
      setSelected(res.data?.data ?? res.data);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  // Auto-refresh open ticket detail every 30s
  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => { void loadDetail(selected.id); }, 30_000);
    return () => clearInterval(t);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages?.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/support/tickets', form);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await loadTickets();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!selected) return;
    if (!confirm(t('support.closeConfirm'))) return;
    setClosing(true);
    try {
      await api.post(`/support/tickets/${selected.id}/close`);
      await loadDetail(selected.id);
      await loadTickets();
    } finally {
      setClosing(false);
    }
  }

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('support.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('support.subtitle')}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> {t('support.newTicket')}
        </button>
      </div>

      {/* Ticket list */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('support.colNo')}</th>
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('support.subject')}</th>
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('support.category')}</th>
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('support.priority')}</th>
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('common.status')}</th>
              <th className="text-left text-xs text-muted font-medium px-4 py-3">{t('support.date')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted text-sm">{t('common.loading')}</td></tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <MessageSquare size={32} className="text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-muted text-sm">{t('support.noTickets')}</p>
                </td>
              </tr>
            ) : tickets.map((tk) => (
              <tr
                key={tk.ticketId}
                onClick={() => { void loadDetail(tk.ticketId); }}
                className="border-b border-border last:border-0 hover:bg-surface-2 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted">{tk.ticketNo}</td>
                <td className="px-4 py-3 font-medium">{tk.subject}</td>
                <td className="px-4 py-3 text-muted text-xs">{CATEGORY_KEY[tk.category] ? t(CATEGORY_KEY[tk.category]) : tk.category}</td>
                <td className={`px-4 py-3 text-xs font-semibold ${PRIORITY_COLOR[tk.priority] ?? 'text-muted'}`}>
                  {PRIORITY_KEY[tk.priority] ? t(PRIORITY_KEY[tk.priority]) : tk.priority}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[tk.status] ?? 'bg-gray-700 text-muted border-gray-600'}`}>
                    {STATUS_KEY[tk.status] ? t(STATUS_KEY[tk.status]) : tk.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{new Date(tk.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="px-4 py-3 text-muted"><ChevronRight size={15} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ticket Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-2xl bg-surface border-l border-border h-full flex flex-col shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <p className="text-xs text-muted font-mono">{selected.ticketNo}</p>
                <h2 className="text-sm font-semibold">{selected.subject}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { void loadDetail(selected.id); }}
                  disabled={detailLoading}
                  className="p-1.5 text-muted hover:text-fg rounded-lg hover:bg-surface-2 transition-colors"
                  title={t('support.refresh')}
                >
                  <RefreshCw size={13} className={detailLoading ? 'animate-spin' : ''} />
                </button>
                {(selected.status === 'OPEN' || selected.status === 'IN_PROGRESS') && (
                  <button
                    onClick={() => { void handleClose(); }}
                    disabled={closing}
                    className="text-xs text-danger hover:text-danger/80 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {t('support.closeTicket')}
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="p-1.5 text-muted hover:text-fg rounded-lg hover:bg-surface-2 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Ticket meta */}
            <div className="flex gap-4 px-5 py-3 border-b border-border shrink-0">
              <MetaTag label={t('common.status')}>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[selected.status] ?? ''}`}>
                  {STATUS_KEY[selected.status] ? t(STATUS_KEY[selected.status]) : selected.status}
                </span>
              </MetaTag>
              <MetaTag label={t('support.priority')}>
                <span className={`text-xs font-semibold ${PRIORITY_COLOR[selected.priority] ?? 'text-muted'}`}>
                  {PRIORITY_KEY[selected.priority] ? t(PRIORITY_KEY[selected.priority]) : selected.priority}
                </span>
              </MetaTag>
              <MetaTag label={t('support.category')}>
                <span className="text-xs text-muted">{CATEGORY_KEY[selected.category] ? t(CATEGORY_KEY[selected.category]) : selected.category}</span>
              </MetaTag>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {detailLoading && selected.messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={20} className="animate-spin text-muted" />
                </div>
              ) : (selected.messages ?? []).map((m) => (
                <div key={m.id} className={`flex ${m.isStaff ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                    m.isStaff
                      ? 'bg-surface-2 border border-border'
                      : 'bg-primary/10 border border-primary/40'
                  }`}>
                    <p className="text-xs text-muted mb-1">
                      {m.isStaff ? (m.authorName ?? t('support.staffName')) : t('support.you')} · {new Date(m.createdAt).toLocaleString('tr-TR')}
                    </p>
                    <p className="text-sm text-fg whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{t('support.newTicketTitle')}</h2>
              <button onClick={() => setCreateOpen(false)} className="text-muted hover:text-fg p-1 rounded-lg hover:bg-surface-2 transition-colors">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={(e) => { void handleCreate(e); }} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">{t('support.subject')} <span className="text-danger">*</span></label>
                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleField}
                  placeholder={t('support.subjectPlaceholder')}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">{t('support.category')}</label>
                  <select name="category" value={form.category} onChange={handleField} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="TECHNICAL">{t('support.categoryTechnical')}</option>
                    <option value="BILLING">{t('support.categoryBilling')}</option>
                    <option value="GENERAL">{t('support.categoryGeneral')}</option>
                    <option value="FEATURE">{t('support.categoryFeature')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">{t('support.priority')}</label>
                  <select name="priority" value={form.priority} onChange={handleField} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="LOW">{t('support.priorityLow')}</option>
                    <option value="MEDIUM">{t('support.priorityMedium')}</option>
                    <option value="HIGH">{t('support.priorityHigh')}</option>
                    <option value="CRITICAL">{t('support.priorityCritical')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">{t('support.message')} <span className="text-danger">*</span></label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleField}
                  rows={4}
                  placeholder={t('support.messagePlaceholder')}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-muted hover:text-fg rounded-lg hover:bg-surface-2 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg transition-colors">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {t('support.send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaTag({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{label}</p>
      {children}
    </div>
  );
}
