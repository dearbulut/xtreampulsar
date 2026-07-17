import { useMemo, useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useEpisodes, useCreateEpisode, useUpdateEpisode, useDeleteEpisode } from '@/hooks/useEpisodes';
import type { Episode, Stream } from '@/types';

interface EpisodeForm {
  season: string;
  episode: string;
  title: string;
  primaryUrl: string;
  containerExtension: string;
  plot: string;
}

const EMPTY_EPISODE_FORM: EpisodeForm = {
  season: '', episode: '', title: '', primaryUrl: '', containerExtension: 'mkv', plot: '',
};

export function EpisodeManagerModal({ series, onClose }: { series: Stream; onClose: () => void }) {
  const { data: episodes, isLoading } = useEpisodes(series.id);
  const createEpisode = useCreateEpisode(series.id);
  const updateEpisode = useUpdateEpisode(series.id);
  const deleteEpisode = useDeleteEpisode(series.id);

  const [form, setForm] = useState<EpisodeForm>(EMPTY_EPISODE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sezon numarasına göre grupla (artan sıra).
  const seasons = useMemo(() => {
    const map = new Map<number, Episode[]>();
    for (const ep of episodes ?? []) {
      const arr = map.get(ep.season) ?? [];
      arr.push(ep);
      map.set(ep.season, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [episodes]);

  const resetForm = () => { setForm(EMPTY_EPISODE_FORM); setEditingId(null); };

  const startEdit = (ep: Episode) => {
    setEditingId(ep.id);
    setForm({
      season: String(ep.season),
      episode: String(ep.episode),
      title: ep.title ?? '',
      primaryUrl: ep.primaryUrl,
      containerExtension: ep.containerExtension || 'mkv',
      plot: ep.plot ?? '',
    });
  };

  const canSubmit = !!form.season && !!form.episode && !!form.primaryUrl;
  const isPending = createEpisode.isPending || updateEpisode.isPending;

  const submit = () => {
    const data = {
      season: Number(form.season),
      episode: Number(form.episode),
      title: form.title || undefined,
      primaryUrl: form.primaryUrl,
      containerExtension: form.containerExtension || 'mkv',
      plot: form.plot || undefined,
    };
    if (editingId) {
      updateEpisode.mutate({ episodeId: editingId, data }, { onSuccess: resetForm });
    } else {
      createEpisode.mutate(data, { onSuccess: resetForm });
    }
  };

  return (
    <Modal open onClose={onClose} title={`Bölümler — ${series.name}`} size="xl">
      <div className="space-y-4">
        {/* Ekle / Düzenle formu */}
        <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">
            {editingId ? 'Bölüm Düzenle' : 'Yeni Bölüm'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Sezon *</label>
              <input
                type="number"
                className="input"
                placeholder="1"
                value={form.season}
                onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Bölüm *</label>
              <input
                type="number"
                className="input"
                placeholder="1"
                value={form.episode}
                onChange={(e) => setForm((f) => ({ ...f, episode: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Başlık</label>
            <input
              className="input"
              placeholder="Bölüm adı"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Kaynak URL *</label>
            <input
              className="input font-mono text-xs"
              placeholder="http://…"
              value={form.primaryUrl}
              onChange={(e) => setForm((f) => ({ ...f, primaryUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Konteyner</label>
            <input
              className="input"
              placeholder="mkv"
              value={form.containerExtension}
              onChange={(e) => setForm((f) => ({ ...f, containerExtension: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Özet</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Bölüm özeti…"
              value={form.plot}
              onChange={(e) => setForm((f) => ({ ...f, plot: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <button onClick={resetForm} className="btn-ghost text-xs flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                Vazgeç
              </button>
            )}
            <button
              disabled={!canSubmit || isPending}
              onClick={submit}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isPending ? 'Kaydediliyor…' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </div>

        {/* Bölüm listesi (sezona göre) */}
        <div className="max-h-[45vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted py-4 text-center">Yükleniyor…</p>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">Henüz bölüm eklenmemiş.</p>
          ) : (
            seasons.map(([season, eps]) => (
              <div key={season}>
                <h4 className="text-sm font-semibold text-foreground mb-2">Sezon {season}</h4>
                <div className="space-y-1">
                  {eps.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                    >
                      <span className="text-xs font-mono text-muted shrink-0 w-8">#{ep.episode}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{ep.title || `Bölüm ${ep.episode}`}</p>
                        <p className="text-[11px] text-muted font-mono truncate">{ep.primaryUrl}</p>
                      </div>
                      <button
                        type="button"
                        title="Düzenle"
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-blue-400 transition-colors"
                        onClick={() => startEdit(ep)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Sil"
                        className="p-1.5 rounded-lg hover:bg-surface-2 text-danger transition-colors"
                        onClick={() => setDeleteId(ep.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteEpisode.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title="Bölüm Sil"
        message="Bu bölüm kalıcı olarak silinecek."
        confirmLabel="Sil"
        loading={deleteEpisode.isPending}
      />
    </Modal>
  );
}
