import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Plus, Pencil, Trash2, Check, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useFeaturedEvents, useCreateFeatured, useUpdateFeatured, useDeleteFeatured, type FeaturedEvent } from '@/hooks/useFeatured';
import { cn } from '@/lib/utils';

interface FormState {
  id?: string;
  title: string;
  description: string;
  logoUrl: string;
  startsAt: string;   // datetime-local value
  streamId: string;
  isActive: boolean;
  sortOrder: string;
}
const EMPTY: FormState = { title: '', description: '', logoUrl: '', startsAt: '', streamId: '', isActive: true, sortOrder: '0' };

function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function FeaturedEventsPage() {
  const { t } = useTranslation();
  const { data: events = [], isLoading } = useFeaturedEvents();
  const createMut = useCreateFeatured();
  const updateMut = useUpdateFeatured();
  const deleteMut = useDeleteFeatured();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (e: FeaturedEvent) => {
    setForm({
      id: e.id, title: e.title, description: e.description ?? '', logoUrl: e.logoUrl ?? '',
      startsAt: toLocalInput(e.startsAt), streamId: e.streamId ?? '', isActive: e.isActive, sortOrder: String(e.sortOrder),
    });
    setOpen(true);
  };

  const save = () => {
    const body = {
      title: form.title.trim() || 'Etkinlik',
      description: form.description || null,
      logoUrl: form.logoUrl || null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      streamId: form.streamId || null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    if (form.id) updateMut.mutate({ id: form.id, body }, { onSuccess: () => setOpen(false) });
    else createMut.mutate(body, { onSuccess: () => setOpen(false) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('featured.title')}
        description={t('featured.description')}
        actions={<button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> {t('featured.new')}</button>}
      />

      {isLoading ? (
        <div className="text-sm text-muted">{t('common.loading')}</div>
      ) : events.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>{t('featured.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((e) => (
            <div key={e.id} className={cn('card p-4 space-y-2', !e.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {e.logoUrl
                    ? <img src={e.logoUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center flex-shrink-0"><Star className="w-4 h-4 text-amber-400" /></div>}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.title}</div>
                    {e.startsAt && (
                      <div className="text-[11px] text-muted flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> {new Date(e.startsAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-blue-400"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {e.description && <p className="text-xs text-muted line-clamp-2">{e.description}</p>}
              {!e.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted">{t('featured.inactive')}</span>}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? t('featured.editTitle') : t('featured.new')} size="md">
        <div className="space-y-3">
          <div>
            <label className="label">{t('featured.eventTitle')}</label>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('featured.eventDesc')}</label>
            <textarea className="input min-h-[54px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('featured.startsAt')}</label>
              <input type="datetime-local" className="input" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('featured.sortOrder')}</label>
              <input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">{t('featured.logoUrl')}</label>
            <input className="input font-mono text-xs" placeholder="https://…" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('featured.streamId')} <span className="text-muted text-xs">{t('featured.optional')}</span></label>
            <input className="input font-mono text-xs" placeholder="stream id" value={form.streamId} onChange={(e) => setForm((f) => ({ ...f, streamId: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            {t('featured.active')}
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button className="btn-ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={save} disabled={!form.title.trim() || createMut.isPending || updateMut.isPending}>
              <Check className="w-4 h-4" /> {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={t('featured.deleteTitle')}
        message={t('featured.deleteConfirm')}
        confirmLabel={t('common.delete')}
        onConfirm={() => { if (deleteId) deleteMut.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
