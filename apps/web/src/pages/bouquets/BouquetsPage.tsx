import { useState } from 'react';
import { Plus, Trash2, Edit2, RefreshCw, Layers } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  useBouquets,
  useCreateBouquet,
  useUpdateBouquet,
  useDeleteBouquet,
  useResignBouquet,
  type Bouquet,
} from '@/hooks/useBouquets';
import { cn } from '@/lib/utils';

interface FormState { name: string; description: string }
const FORM_DEFAULT: FormState = { name: '', description: '' };

export function BouquetsPage() {
  const { data: bouquets = [], isLoading } = useBouquets();
  const createBouquet = useCreateBouquet();
  const updateBouquet = useUpdateBouquet();
  const deleteBouquet = useDeleteBouquet();
  const resignBouquet = useResignBouquet();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [resigningId, setResigningId] = useState<string | null>(null);

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setShowModal(true); };
  const openEdit = (b: Bouquet) => {
    setForm({ name: b.name, description: b.description ?? '' });
    setEditTarget(b.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: form.name, description: form.description || undefined };
    if (editTarget) {
      await updateBouquet.mutateAsync({ id: editTarget, data: payload });
    } else {
      await createBouquet.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bouquet silinsin mi?')) return;
    await deleteBouquet.mutateAsync(id);
  };

  const handleResign = async (id: string) => {
    setResigningId(id);
    try {
      await resignBouquet.mutateAsync(id);
    } finally {
      setResigningId(null);
    }
  };

  const columns: Column<Bouquet>[] = [
    {
      key: 'name',
      header: 'Bouquet',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="font-medium text-slate-200">{row.name}</div>
            {row.description && <div className="text-xs text-muted truncate max-w-[180px]">{row.description}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'categories',
      header: 'Kategoriler',
      render: (row) => (
        <span className="text-sm font-semibold text-slate-200">{row._count?.categories ?? 0}</span>
      ),
    },
    {
      key: 'streams',
      header: 'Akışlar',
      render: (row) => (
        <span className="text-sm font-semibold text-slate-200">{row._count?.bouquetStreams ?? 0}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Durum',
      render: (row) => (
        <span className={cn('badge', row.isActive ? 'badge-success' : 'badge-gray')}>
          {row.isActive ? 'Aktif' : 'Pasif'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost p-1.5 text-xs"
            title="ReSign"
            onClick={() => void handleResign(row.id)}
            disabled={resigningId === row.id}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', resigningId === row.id && 'animate-spin')} />
          </button>
          <button className="btn btn-ghost p-1.5" onClick={() => openEdit(row)}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost p-1.5 hover:text-danger" onClick={() => void handleDelete(row.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bouquet'lar</h1>
          <p className="text-sm text-muted mt-0.5">{bouquets.length} bouquet</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Bouquet Ekle
        </button>
      </div>

      <DataTable columns={columns} data={bouquets} isLoading={isLoading} emptyMessage="Bouquet bulunamadı" />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Bouquet Düzenle' : 'Bouquet Ekle'} size="sm">
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">Ad</label>
            <input required className="input" value={form.name} onChange={f('name')} placeholder="Türk Kanallar Paketi" />
          </div>
          <div>
            <label className="label">Açıklama (opsiyonel)</label>
            <textarea
              className="input resize-none h-20"
              value={form.description}
              onChange={f('description')}
              placeholder="Bu bouquet hakkında kısa açıklama…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={createBouquet.isPending || updateBouquet.isPending}>
              {editTarget ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
