import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, RefreshCw, Layers, List, Search, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Copy } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  useBouquets,
  useCreateBouquet,
  useUpdateBouquet,
  useDeleteBouquet,
  useResignBouquet,
  useCloneBouquet,
  useBouquetStreams,
  useReplaceBouquetStreams,
  type Bouquet,
  type BouquetStream,
} from '@/hooks/useBouquets';
import { useStreams } from '@/hooks/useStreams';
import { cn } from '@/lib/utils';

interface FormState { name: string; description: string }
const FORM_DEFAULT: FormState = { name: '', description: '' };

function StreamAssignModal({ bouquet, onClose }: { bouquet: Bouquet; onClose: () => void }) {
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());

  const { data: allStreamsData, isLoading: streamsLoading } = useStreams({ limit: 500 });
  const { data: bouquetStreams = [], isLoading: bsLoading } = useBouquetStreams(bouquet.id);
  const replaceMutation = useReplaceBouquetStreams();

  const [assigned, setAssigned] = useState<BouquetStream[] | null>(null);

  const effectiveAssigned = assigned ?? bouquetStreams;
  const assignedIds = useMemo(() => new Set(effectiveAssigned.map((s) => s.id)), [effectiveAssigned]);

  const allStreams = allStreamsData?.items ?? [];
  const available = allStreams.filter((s) => !assignedIds.has(s.id));

  const filteredAvailable = available.filter((s) =>
    s.name.toLowerCase().includes(leftSearch.toLowerCase()),
  );
  const filteredAssigned = effectiveAssigned.filter((s) =>
    s.name.toLowerCase().includes(rightSearch.toLowerCase()),
  );

  const moveToRight = () => {
    const toMove = allStreams.filter((s) => leftSelected.has(s.id));
    setAssigned([...effectiveAssigned, ...toMove.map((s) => ({
      id: s.id, name: s.name, externalId: s.externalId, status: s.status,
      tvgLogo: s.tvgLogo, isActive: s.isActive, category: s.category,
    }))]);
    setLeftSelected(new Set());
  };

  const moveAllToRight = () => {
    setAssigned([...effectiveAssigned, ...available.map((s) => ({
      id: s.id, name: s.name, externalId: s.externalId, status: s.status,
      tvgLogo: s.tvgLogo, isActive: s.isActive, category: s.category,
    }))]);
    setLeftSelected(new Set());
  };

  const moveToLeft = () => {
    setAssigned(effectiveAssigned.filter((s) => !rightSelected.has(s.id)));
    setRightSelected(new Set());
  };

  const moveAllToLeft = () => {
    setAssigned([]);
    setRightSelected(new Set());
  };

  const toggleLeft = (id: string) => {
    setLeftSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleRight = (id: string) => {
    setRightSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSave = async () => {
    await replaceMutation.mutateAsync({ id: bouquet.id, streamIds: effectiveAssigned.map((s) => s.id) });
    onClose();
  };

  const loading = streamsLoading || bsLoading;

  return (
    <Modal open onClose={onClose} title={`Stream Yönetimi — ${bouquet.name}`} size="lg">
      {loading ? (
        <div className="p-10 text-center text-muted">Yükleniyor…</div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
            {/* Left — Available */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted uppercase tracking-wide">
                Mevcut Kanallar ({filteredAvailable.length})
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  className="input pl-8 h-8 text-sm"
                  placeholder="Ara…"
                  value={leftSearch}
                  onChange={(e) => setLeftSearch(e.target.value)}
                />
              </div>
              <div className="border border-border rounded-lg overflow-y-auto h-72 bg-surface-2/20">
                {filteredAvailable.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted text-sm">Kanal yok</div>
                )}
                {filteredAvailable.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => toggleLeft(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-border/30 last:border-0',
                      leftSelected.has(s.id) ? 'bg-primary/15 text-primary-light' : 'hover:bg-surface-2',
                    )}
                  >
                    {s.tvgLogo && (
                      <img src={s.tvgLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted flex-shrink-0">{s.category?.type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow buttons */}
            <div className="flex flex-col gap-2 pt-12">
              <button onClick={moveAllToRight} title="Tümünü Ekle" className="btn-ghost p-1.5 hover:text-success" disabled={available.length === 0}>
                <ChevronsRight className="w-4 h-4" />
              </button>
              <button onClick={moveToRight} title="Seçilileri Ekle" className="btn-ghost p-1.5 hover:text-primary" disabled={leftSelected.size === 0}>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={moveToLeft} title="Seçilileri Çıkar" className="btn-ghost p-1.5 hover:text-warning" disabled={rightSelected.size === 0}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={moveAllToLeft} title="Tümünü Çıkar" className="btn-ghost p-1.5 hover:text-danger" disabled={effectiveAssigned.length === 0}>
                <ChevronsLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Right — Assigned */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted uppercase tracking-wide">
                Bouquet'teki Kanallar ({filteredAssigned.length})
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  className="input pl-8 h-8 text-sm"
                  placeholder="Ara…"
                  value={rightSearch}
                  onChange={(e) => setRightSearch(e.target.value)}
                />
              </div>
              <div className="border border-border rounded-lg overflow-y-auto h-72 bg-surface-2/20">
                {filteredAssigned.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted text-sm">Kanal eklenmemiş</div>
                )}
                {filteredAssigned.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => toggleRight(s.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b border-border/30 last:border-0',
                      rightSelected.has(s.id) ? 'bg-primary/15 text-primary-light' : 'hover:bg-surface-2',
                    )}
                  >
                    {s.tvgLogo && (
                      <img src={s.tvgLogo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="truncate flex-1">{s.name}</span>
                    <span className="text-[10px] text-muted flex-shrink-0">{s.category?.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button className="btn-ghost" onClick={onClose}>İptal</button>
            <button
              className="btn-primary flex items-center gap-2"
              disabled={replaceMutation.isPending}
              onClick={() => void handleSave()}
            >
              {replaceMutation.isPending ? 'Kaydediliyor…' : `Kaydet (${effectiveAssigned.length} kanal)`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function BouquetsPage() {
  const { data: bouquets = [], isLoading } = useBouquets();
  const createBouquet = useCreateBouquet();
  const updateBouquet = useUpdateBouquet();
  const deleteBouquet = useDeleteBouquet();
  const resignBouquet = useResignBouquet();
  const cloneBouquet = useCloneBouquet();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [resigningId, setResigningId] = useState<string | null>(null);
  const [streamBouquet, setStreamBouquet] = useState<Bouquet | null>(null);

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
      key: 'users',
      header: 'Kullanıcılar',
      render: (row) => (
        <span className="text-sm font-semibold text-blue-400">{row._count?.userBouquets ?? 0}</span>
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
            title="Stream Yönetimi"
            onClick={(e) => { e.stopPropagation(); setStreamBouquet(row); }}
          >
            <List className="w-3.5 h-3.5 text-primary" />
          </button>
          <button
            className="btn btn-ghost p-1.5 text-xs"
            title="ReSign"
            onClick={(e) => { e.stopPropagation(); void handleResign(row.id); }}
            disabled={resigningId === row.id}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', resigningId === row.id && 'animate-spin')} />
          </button>
          <button
            className="btn btn-ghost p-1.5 text-xs"
            title="Klonla"
            onClick={(e) => { e.stopPropagation(); cloneBouquet.mutate(row.id); }}
            disabled={cloneBouquet.isPending}
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
          </button>
          <button className="btn btn-ghost p-1.5" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button className="btn btn-ghost p-1.5 hover:text-danger" onClick={(e) => { e.stopPropagation(); void handleDelete(row.id); }}>
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

      {streamBouquet && (
        <StreamAssignModal
          bouquet={streamBouquet}
          onClose={() => setStreamBouquet(null)}
        />
      )}
    </div>
  );
}
