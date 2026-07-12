import { useState } from 'react';
import { Plus, Trash2, Edit2, Package as PackageIcon, Clock, Users, Coins, ToggleLeft, ToggleRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { usePackages, useCreatePackage, useUpdatePackage, useDeletePackage } from '@/hooks/usePackages';
import { useBouquets } from '@/hooks/useBouquets';
import type { Package } from '@/types';
import { cn } from '@/lib/utils';

interface FormState {
  name: string;
  durationDays: string;
  maxConnections: string;
  creditCost: string;
  price: string;
  description: string;
  bouquetIds: string[];
}
const FORM_DEFAULT: FormState = { name: '', durationDays: '30', maxConnections: '1', creditCost: '30', price: '0', description: '', bouquetIds: [] };

export function PackagesPage() {
  const { data: packages = [], isLoading } = usePackages();
  const { data: bouquets = [] } = useBouquets();
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const deletePkg = useDeletePackage();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const toggleBouquet = (id: string) =>
    setForm((p) => ({ ...p, bouquetIds: p.bouquetIds.includes(id) ? p.bouquetIds.filter((b) => b !== id) : [...p.bouquetIds, id] }));

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setShowModal(true); };
  const openEdit = (p: Package) => {
    setForm({
      name: p.name,
      durationDays: String(p.durationDays),
      maxConnections: String(p.maxConnections),
      creditCost: String(p.creditCost),
      price: String(p.price ?? 0),
      description: p.description ?? '',
      bouquetIds: p.bouquets?.map((b) => b.id) ?? [],
    });
    setEditTarget(p.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      durationDays: parseInt(form.durationDays, 10),
      maxConnections: parseInt(form.maxConnections, 10),
      creditCost: parseInt(form.creditCost, 10),
      price: parseFloat(form.price),
      description: form.description || undefined,
      bouquetIds: form.bouquetIds,
    };
    if (editTarget) {
      await updatePkg.mutateAsync({ id: editTarget, data: payload });
    } else {
      await createPkg.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Paket silinsin mi?')) return;
    await deletePkg.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Paketler</h1>
          <p className="text-sm text-muted mt-0.5">{packages.length} paket</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Paket Ekle
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card animate-pulse h-44" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="card py-16 text-center">
          <PackageIcon className="w-12 h-12 text-muted mx-auto mb-3" />
          <div className="text-slate-400 font-medium">Henüz paket yok</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className={cn('card p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors', !pkg.isActive && 'opacity-60')}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', pkg.isActive ? 'bg-primary/10' : 'bg-surface-2')}>
                    <PackageIcon className={cn('w-5 h-5', pkg.isActive ? 'text-primary-light' : 'text-muted')} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{pkg.name}</div>
                    {pkg.description && (
                      <div className="text-xs text-muted truncate max-w-[140px]">{pkg.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost p-1.5"
                    title={pkg.isActive ? 'Pasif yap' : 'Aktif yap'}
                    onClick={() => updatePkg.mutate({ id: pkg.id, data: { isActive: !pkg.isActive } })}
                  >
                    {pkg.isActive
                      ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                      : <ToggleLeft className="w-4 h-4 text-muted" />}
                  </button>
                  <button className="btn btn-ghost p-1.5" onClick={() => openEdit(pkg)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-ghost p-1.5 hover:text-danger"
                    onClick={() => void handleDelete(pkg.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <Clock className="w-3.5 h-3.5 text-muted mx-auto mb-1" />
                  <div className="text-sm font-bold text-slate-200">{pkg.durationDays}g</div>
                  <div className="text-[10px] text-muted">Süre</div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <Users className="w-3.5 h-3.5 text-muted mx-auto mb-1" />
                  <div className="text-sm font-bold text-slate-200">{pkg.maxConnections}</div>
                  <div className="text-[10px] text-muted">Bağlantı</div>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <Coins className="w-3.5 h-3.5 text-primary-light mx-auto mb-1" />
                  <div className="text-sm font-bold text-primary-light">{pkg.creditCost}</div>
                  <div className="text-[10px] text-muted">Kredi</div>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <Users className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                  <div className="text-sm font-bold text-blue-400">{pkg._count?.users ?? 0}</div>
                  <div className="text-[10px] text-muted">Kullanıcı</div>
                </div>
              </div>

              {/* Price */}
              {pkg.price != null && pkg.price > 0 && (
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-xs text-muted">Satış Fiyatı</span>
                  <span className="text-sm font-bold text-slate-200">₺{pkg.price.toFixed(2)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Paketi Düzenle' : 'Paket Ekle'} size="md">
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">Paket Adı</label>
            <input required className="input" value={form.name} onChange={f('name')} placeholder="Standart 1 Aylık" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Süre (gün)</label>
              <input required type="number" className="input" value={form.durationDays} onChange={f('durationDays')} min="1" />
            </div>
            <div>
              <label className="label">Maks Bağlantı</label>
              <input required type="number" className="input" value={form.maxConnections} onChange={f('maxConnections')} min="1" />
            </div>
            <div>
              <label className="label">Kredi Maliyeti</label>
              <input required type="number" className="input" value={form.creditCost} onChange={f('creditCost')} min="0" />
            </div>
            <div>
              <label className="label">Fiyat (₺)</label>
              <input type="number" step="0.01" className="input" value={form.price} onChange={f('price')} min="0" />
            </div>
          </div>
          <div>
            <label className="label">Açıklama (opsiyonel)</label>
            <textarea className="input resize-none h-16" value={form.description} onChange={f('description')} />
          </div>
          <div>
            <label className="label">Bouquet'ler (opsiyonel)</label>
            <p className="text-xs text-muted mb-2">Bu paketi alan kullanıcılar seçilen bouquet'leri otomatik alır. Boş bırakılırsa kullanıcıya varsayılan bouquet atanır.</p>
            {bouquets.length === 0 ? (
              <p className="text-xs text-muted">Henüz bouquet yok.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border/40">
                {bouquets.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.bouquetIds.includes(b.id)}
                      onChange={() => toggleBouquet(b.id)}
                    />
                    <span className="text-slate-300">{b.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={createPkg.isPending || updatePkg.isPending}>
              {editTarget ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
