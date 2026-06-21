import { useState } from 'react';
import { Plus, Trash2, Edit2, FolderOpen } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, type Category } from '@/hooks/useCategories';
import { useBouquets } from '@/hooks/useBouquets';
import { cn } from '@/lib/utils';

const TYPE_TABS: TabItem[] = [
  { id: '', label: 'Tümü' },
  { id: 'LIVE', label: 'Canlı' },
  { id: 'VOD', label: 'VOD' },
  { id: 'SERIES', label: 'Dizi' },
];

const TYPE_BADGE: Record<string, string> = {
  LIVE: 'badge-blue',
  VOD: 'badge-purple',
  SERIES: 'badge-warning',
};

const TYPE_LABEL: Record<string, string> = {
  LIVE: 'Canlı',
  VOD: 'VOD',
  SERIES: 'Dizi',
};

interface FormState { name: string; type: string; bouquetId: string }
const FORM_DEFAULT: FormState = { name: '', type: 'LIVE', bouquetId: '' };

export function CategoriesPage() {
  const [activeTab, setActiveTab] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);

  const { data: categories = [], isLoading } = useCategories(activeTab || undefined);
  const { data: bouquets = [] } = useBouquets();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setShowModal(true); };
  const openEdit = (c: Category) => {
    setForm({ name: c.name, type: c.type, bouquetId: c.bouquetId });
    setEditTarget(c.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editTarget) {
      await updateCat.mutateAsync({ id: editTarget, data: form });
    } else {
      await createCat.mutateAsync(form);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Kategori silinsin mi?')) return;
    await deleteCat.mutateAsync(id);
  };

  const tabsWithCount = TYPE_TABS.map((t) => ({
    ...t,
    badge: t.id === '' ? categories.length : categories.filter((c) => c.type === t.id).length,
  }));

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Kategori',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <div className="font-medium text-slate-200">{row.name}</div>
            {row.bouquet && <div className="text-xs text-muted">{row.bouquet.name}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tür',
      render: (row) => (
        <span className={cn('badge', TYPE_BADGE[row.type])}>{TYPE_LABEL[row.type]}</span>
      ),
    },
    {
      key: 'streams',
      header: 'Akış',
      render: (row) => <span className="text-sm">{row._count?.streams ?? 0}</span>,
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Kategoriler</h1>
          <p className="text-sm text-muted mt-0.5">{categories.length} kategori</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Kategori Ekle
        </button>
      </div>

      <Tabs tabs={tabsWithCount} active={activeTab} onChange={setActiveTab} />

      <DataTable columns={columns} data={categories} isLoading={isLoading} emptyMessage="Kategori bulunamadı" />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Düzenle' : 'Kategori Ekle'} size="sm">
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">Ad</label>
            <input required className="input" value={form.name} onChange={f('name')} placeholder="Türk Kanallar" />
          </div>
          <div>
            <label className="label">Tür</label>
            <select className="input" value={form.type} onChange={f('type')}>
              <option value="LIVE">Canlı</option>
              <option value="VOD">VOD</option>
              <option value="SERIES">Dizi</option>
            </select>
          </div>
          <div>
            <label className="label">Bouquet</label>
            <select required className="input" value={form.bouquetId} onChange={f('bouquetId')}>
              <option value="">Seçin…</option>
              {bouquets.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={createCat.isPending || updateCat.isPending}>
              {editTarget ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
