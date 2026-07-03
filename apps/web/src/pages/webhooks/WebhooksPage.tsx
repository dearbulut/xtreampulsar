import { useState } from 'react';
import { Plus, Trash2, Pencil, FlaskConical, ToggleLeft, ToggleRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
} from '@/hooks/useWebhooks';
import type { Webhook } from '@/types';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const ALL_EVENTS = [
  { value: 'user.created',      label: 'Kullanıcı Oluşturuldu' },
  { value: 'user.expired',      label: 'Kullanıcı Süresi Doldu' },
  { value: 'user.connected',    label: 'Kullanıcı Bağlandı' },
  { value: 'user.disconnected', label: 'Kullanıcı Bağlantısı Kesildi' },
] as const;

const EMPTY_FORM = { name: '', url: '', secret: '', events: [] as string[] };

function statusColor(code: number | null | undefined): string {
  if (code == null) return 'text-muted';
  if (code >= 200 && code < 300) return 'text-emerald-400';
  return 'text-red-400';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

interface TestResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

export function WebhooksPage() {
  const { data: webhooksRaw, isLoading } = useWebhooks();
  const webhooks = Array.isArray(webhooksRaw) ? webhooksRaw : [];
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();

  const [showCreate, setShowCreate] = useState(false);
  const [editWebhook, setEditWebhook] = useState<Webhook | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const openEdit = (wh: Webhook) => {
    setForm({ name: wh.name, url: wh.url, secret: wh.secret ?? '', events: [...wh.events] });
    setEditWebhook(wh);
  };

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const handleCreate = () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('İsim ve URL zorunludur');
      return;
    }
    createWebhook.mutate(
      { name: form.name, url: form.url, secret: form.secret || undefined, events: form.events },
      { onSuccess: () => setShowCreate(false) },
    );
  };

  const handleUpdate = () => {
    if (!editWebhook) return;
    updateWebhook.mutate(
      { id: editWebhook.id, name: form.name, url: form.url, secret: form.secret || null, events: form.events },
      { onSuccess: () => setEditWebhook(null) },
    );
  };

  const handleTest = (id: string) => {
    testWebhook.mutate(id, {
      onSuccess: (res) => setTestResults((prev) => ({ ...prev, [id]: res })),
      onError: () => setTestResults((prev) => ({ ...prev, [id]: { ok: false, status: null, error: 'İstek başarısız' } })),
    });
  };

  const handleToggle = (wh: Webhook) => {
    updateWebhook.mutate({ id: wh.id, isActive: !wh.isActive });
  };

  const FormBody = (
    <div className="space-y-4">
      <div>
        <label className="label">İsim *</label>
        <input className="input" placeholder="Örn: Sipariş sistemi" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label className="label">URL *</label>
        <input className="input font-mono text-xs" placeholder="https://example.com/webhook" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
      </div>
      <div>
        <label className="label">Secret <span className="text-muted text-xs">(opsiyonel)</span></label>
        <input className="input font-mono text-xs" placeholder="HMAC-SHA256 imzası için" value={form.secret} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} />
        <p className="text-xs text-muted mt-1">Belirtilirse X-Webhook-Signature: sha256=... başlığı eklenir.</p>
      </div>
      <div>
        <label className="label">Olaylar</label>
        <div className="space-y-2 mt-1">
          {ALL_EVENTS.map((ev) => (
            <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.events.includes(ev.value)}
                onChange={() => toggleEvent(ev.value)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm">{ev.label}</span>
              <span className="text-xs text-muted font-mono">({ev.value})</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook'lar"
        description="Dış sistemlere HTTP bildirimi gönder"
        actions={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Yeni Webhook
          </button>
        }
      />

      {isLoading ? (
        <div className="text-center text-muted py-12">Yükleniyor…</div>
      ) : webhooks.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <p className="mb-2">Henüz webhook tanımlı değil.</p>
          <p className="text-sm">Dış sistemlere anlık bildirim göndermek için "Yeni Webhook" ekle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {webhooks.map((wh) => {
            const testRes = testResults[wh.id];
            const isTesting = testWebhook.isPending && testWebhook.variables === wh.id;
            return (
              <div key={wh.id} className={cn('card flex flex-col gap-3', !wh.isActive && 'opacity-60')}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{wh.name}</p>
                    <p className="text-xs text-muted font-mono truncate mt-0.5">{wh.url}</p>
                  </div>
                  <button
                    onClick={() => handleToggle(wh)}
                    className="flex-shrink-0 text-muted hover:text-fg transition-colors"
                    title={wh.isActive ? 'Pasif et' : 'Aktif et'}
                  >
                    {wh.isActive
                      ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1">
                  {wh.events.length === 0 ? (
                    <span className="text-xs text-muted">Olay seçilmedi</span>
                  ) : (
                    wh.events.map((ev) => (
                      <span key={ev} className="px-2 py-0.5 rounded-full bg-surface-2 text-xs font-mono">
                        {ev}
                      </span>
                    ))
                  )}
                </div>

                {/* Status row */}
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(wh.lastTriggered)}
                  </span>
                  {wh.lastStatus != null && (
                    <span className={cn('font-mono font-semibold', statusColor(wh.lastStatus))}>
                      HTTP {wh.lastStatus}
                    </span>
                  )}
                </div>

                {/* Test result */}
                {testRes && (
                  <div className={cn('flex items-center gap-1.5 text-xs rounded-lg px-2 py-1', testRes.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    {testRes.ok
                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                    {testRes.ok
                      ? `Başarılı — HTTP ${testRes.status}`
                      : (testRes.error ?? `HTTP ${testRes.status ?? 'hata'}`)}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-border mt-auto">
                  <button
                    onClick={() => handleTest(wh.id)}
                    disabled={isTesting}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-surface-2 text-muted hover:text-fg transition-colors disabled:opacity-50"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    {isTesting ? 'Test…' : 'Test Et'}
                  </button>
                  <button
                    onClick={() => openEdit(wh)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-surface-2 text-muted hover:text-blue-400 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Düzenle
                  </button>
                  <button
                    onClick={() => setDeleteId(wh.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-surface-2 text-muted hover:text-danger transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Webhook" size="md">
        {FormBody}
        <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
          <button onClick={() => setShowCreate(false)} className="btn-ghost">İptal</button>
          <button onClick={handleCreate} disabled={createWebhook.isPending} className="btn-primary">
            {createWebhook.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editWebhook} onClose={() => setEditWebhook(null)} title={`Düzenle — ${editWebhook?.name ?? ''}`} size="md">
        {FormBody}
        <div className="flex gap-2 justify-end pt-4 border-t border-border mt-4">
          <button onClick={() => setEditWebhook(null)} className="btn-ghost">İptal</button>
          <button onClick={handleUpdate} disabled={updateWebhook.isPending} className="btn-primary">
            {updateWebhook.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title="Webhook'u Sil"
        message="Bu webhook kalıcı olarak silinecek. Emin misin?"
        confirmLabel="Sil"
        onConfirm={() => {
          if (deleteId) {
            deleteWebhook.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
          }
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
