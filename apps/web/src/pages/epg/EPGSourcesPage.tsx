import { useState } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Radio } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  useEPGSources,
  useCreateEPGSource,
  useDeleteEPGSource,
  useParseEPGSource,
  useParseAllEPGSources,
  useMassAssignEPG,
} from '@/hooks/useEPG';
import type { EPGSource } from '@/types';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';

export function EPGSourcesPage() {
  const { data: sources = [], isLoading } = useEPGSources();
  const createSource = useCreateEPGSource();
  const deleteSource = useDeleteEPGSource();
  const parseSource = useParseEPGSource();
  const parseAll = useParseAllEPGSources();
  const massAssign = useMassAssignEPG();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', xmltvUrl: '', daysToKeep: '7' });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSource.mutateAsync({
      name: form.name,
      xmltvUrl: form.xmltvUrl,
      daysToKeep: parseInt(form.daysToKeep, 10),
      isActive: true,
    });
    setShowAdd(false);
    setForm({ name: '', xmltvUrl: '', daysToKeep: '7' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('EPG kaynağı silinsin mi?')) return;
    await deleteSource.mutateAsync(id);
  };

  const handleMassAssign = async (id: string) => {
    await massAssign.mutateAsync({ epgSourceId: id, minSimilarity: 0.6 });
  };

  const columns: Column<EPGSource>[] = [
    {
      key: 'name',
      header: 'Kaynak',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <div className="font-medium text-slate-200">{row.name}</div>
            <div className="text-xs text-muted truncate max-w-[200px]">{row.xmltvUrl}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) => (
        <span className={cn('badge', row.isActive ? 'badge-success' : 'badge-gray')}>
          {row.isActive ? 'Aktif' : 'Pasif'}
        </span>
      ),
    },
    {
      key: 'daysToKeep',
      header: 'Saklama',
      render: (row) => <span className="text-sm">{row.daysToKeep ?? 7} gün</span>,
    },
    {
      key: 'updatedAt',
      header: 'Son Güncelleme',
      render: (row) =>
        row.updatedAt
          ? new Date(row.updatedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '-',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => void parseSource.mutateAsync(row.id)}
            disabled={parseSource.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title="Force Reload"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', parseSource.isPending && 'animate-spin')} />
          </button>
          <button
            onClick={() => void handleMassAssign(row.id)}
            disabled={massAssign.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title="Toplu Eşleştir"
          >
            <CheckCircle className="w-3.5 h-3.5 text-success" />
          </button>
          <button
            onClick={() => void handleDelete(row.id)}
            disabled={deleteSource.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title="Sil"
          >
            <XCircle className="w-3.5 h-3.5 text-danger" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">EPG Kaynakları</h1>
          <p className="text-sm text-muted mt-0.5">XMLTV kaynaklarını yönet ve eşleştir</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/epg/mass-assign" className="btn btn-ghost text-sm">
            <CheckCircle className="w-4 h-4" /> Toplu Eşleştir
          </Link>
          <button
            onClick={() => void parseAll.mutateAsync()}
            disabled={parseAll.isPending}
            className="btn btn-ghost text-sm"
          >
            <RefreshCw className={cn('w-4 h-4', parseAll.isPending && 'animate-spin')} /> Tümünü Güncelle
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Kaynak Ekle
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={sources} isLoading={isLoading} emptyMessage="EPG kaynağı bulunamadı" />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="EPG Kaynağı Ekle" size="md">
        <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">Kaynak Adı</label>
            <input required className="input" value={form.name} onChange={f('name')} placeholder="XMLTV Turkey" />
          </div>
          <div>
            <label className="label">XMLTV URL</label>
            <input required className="input" value={form.xmltvUrl} onChange={f('xmltvUrl')} placeholder="http://example.com/epg.xml" />
          </div>
          <div>
            <label className="label">Saklama Süresi (gün)</label>
            <input type="number" className="input" value={form.daysToKeep} onChange={f('daysToKeep')} min="1" max="30" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={createSource.isPending}>Ekle</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
