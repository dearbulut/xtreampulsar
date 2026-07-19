import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Pencil, Trash2, Rss, CheckCircle2, XCircle, Clock } from 'lucide-react';
import {
  useM3uSources, useCreateM3uSource, useUpdateM3uSource, useDeleteM3uSource, useSyncM3uSource,
  type M3uSource, type M3uSourceInput,
} from '@/hooks/useM3uSources';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, cn } from '@/lib/utils';

const EMPTY: M3uSourceInput = { name: '', url: '', defaultType: 'LIVE', conflictMode: 'MERGE', enabled: true, intervalMinutes: 360 };

export function M3uSyncPage() {
  const { t } = useTranslation();
  const { data: sources = [], isLoading } = useM3uSources();
  const create = useCreateM3uSource();
  const update = useUpdateM3uSource();
  const del = useDeleteM3uSource();
  const sync = useSyncM3uSource();

  const [editing, setEditing] = useState<M3uSource | null>(null);
  const [form, setForm] = useState<M3uSourceInput>(EMPTY);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s: M3uSource) => {
    setEditing(s);
    setForm({ name: s.name, url: s.url, defaultType: s.defaultType, conflictMode: s.conflictMode, enabled: s.enabled, intervalMinutes: s.intervalMinutes });
    setModalOpen(true);
  };
  const submit = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    if (editing) update.mutate({ id: editing.id, ...form }, { onSuccess: () => setModalOpen(false) });
    else create.mutate(form, { onSuccess: () => setModalOpen(false) });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('m3uSync.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('m3uSync.subtitle')}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" />{t('m3uSync.add')}
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
        ) : sources.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
            <Rss className="w-10 h-10 text-muted/50" />
            <p className="text-sm text-muted">{t('m3uSync.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">{t('m3uSync.colName')}</th>
                  <th className="table-th">{t('m3uSync.colType')}</th>
                  <th className="table-th">{t('m3uSync.colInterval')}</th>
                  <th className="table-th">{t('m3uSync.colLastSync')}</th>
                  <th className="table-th">{t('m3uSync.colStatus')}</th>
                  <th className="table-th text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="table-row">
                    <td className="table-td">
                      <div className="font-medium text-fg">{s.name}</div>
                      <div className="text-xs text-muted truncate max-w-xs">{s.url}</div>
                    </td>
                    <td className="table-td"><span className="badge badge-gray">{s.defaultType}</span></td>
                    <td className="table-td text-xs text-muted">{t('m3uSync.everyMinutes', { n: s.intervalMinutes })}</td>
                    <td className="table-td text-xs text-muted whitespace-nowrap">
                      {s.lastSyncedAt ? formatDate(s.lastSyncedAt) : <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t('m3uSync.never')}</span>}
                    </td>
                    <td className="table-td">
                      {!s.enabled ? (
                        <span className="badge badge-gray">{t('m3uSync.disabled')}</span>
                      ) : s.lastStatus === 'ERROR' ? (
                        <span className="inline-flex items-center gap-1 text-danger text-xs" title={s.lastMessage ?? ''}><XCircle className="w-4 h-4" />{t('m3uSync.error')}</span>
                      ) : s.lastStatus === 'OK' ? (
                        <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle2 className="w-4 h-4" />{t('m3uSync.ok')}</span>
                      ) : (
                        <span className="badge badge-warning">{t('m3uSync.pending')}</span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost p-1.5" title={t('m3uSync.syncNow')} disabled={sync.isPending}
                          onClick={() => sync.mutate(s.id)}>
                          <RefreshCw className={cn('w-4 h-4 text-primary', sync.isPending && 'animate-spin')} />
                        </button>
                        <button className="btn-ghost p-1.5" title={t('common.edit')} onClick={() => openEdit(s)}>
                          <Pencil className="w-4 h-4 text-blue-400" />
                        </button>
                        <button className="btn-ghost p-1.5" title={t('common.delete')} onClick={() => setDeleteId(s.id)}>
                          <Trash2 className="w-4 h-4 text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('m3uSync.editTitle') : t('m3uSync.add')}>
        <div className="space-y-3">
          <div>
            <label className="label">{t('m3uSync.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Provider X - Events" />
          </div>
          <div>
            <label className="label">{t('m3uSync.url')}</label>
            <input className="input font-mono text-xs" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="http://provider/get.php?username=...&type=m3u_plus" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('m3uSync.type')}</label>
              <select className="input" value={form.defaultType} onChange={(e) => setForm({ ...form, defaultType: e.target.value })}>
                <option value="LIVE">LIVE</option>
                <option value="VOD">VOD</option>
                <option value="SERIES">SERIES</option>
              </select>
            </div>
            <div>
              <label className="label">{t('m3uSync.conflictMode')}</label>
              <select className="input" value={form.conflictMode} onChange={(e) => setForm({ ...form, conflictMode: e.target.value })}>
                <option value="MERGE">MERGE</option>
                <option value="OVERWRITE">OVERWRITE</option>
                <option value="SKIP">SKIP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t('m3uSync.intervalMinutes')}</label>
            <input type="number" min={5} className="input" value={form.intervalMinutes} onChange={(e) => setForm({ ...form, intervalMinutes: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            {t('m3uSync.enabled')}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
            <button className="btn-primary" disabled={!form.name.trim() || !form.url.trim() || create.isPending || update.isPending} onClick={submit}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={t('m3uSync.deleteTitle')}
        message={t('m3uSync.deleteConfirm')}
        onConfirm={() => { if (deleteId) del.mutate(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
