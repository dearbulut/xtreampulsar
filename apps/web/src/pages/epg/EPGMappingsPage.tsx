import { useState, useMemo } from 'react';
import { Search, Link2, Link2Off, Loader2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  useEPGSources,
  useEPGChannels,
  useEPGMappings,
  useCreateEPGMapping,
  useDeleteEPGMapping,
  type EPGMapping,
} from '@/hooks/useEPG';
import { useStreams } from '@/hooks/useStreams';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import type { Stream } from '@/types';

export function EPGMappingsPage() {
  const [selectedSource, setSelectedSource] = useState('');
  const [streamSearch, setStreamSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mappingTarget, setMappingTarget] = useState<{ stream: Stream } | null>(null);
  const [epgSearch, setEpgSearch] = useState('');

  const { data: sources = [] } = useEPGSources();
  const { data: streamsData, isLoading } = useStreams({ type: 'LIVE', search: streamSearch, categoryId, limit: 100 });
  const { data: mappings = [] } = useEPGMappings();
  const { data: epgChannels = [], isLoading: loadingChannels } = useEPGChannels(selectedSource, epgSearch);
  const { data: categories = [] } = useCategories('LIVE');
  const createMapping = useCreateEPGMapping();
  const deleteMapping = useDeleteEPGMapping();

  const mappingByStream = useMemo(() => {
    const map = new Map<string, EPGMapping>();
    mappings.forEach((m) => map.set(m.streamId, m));
    return map;
  }, [mappings]);

  const streams = streamsData?.items ?? [];

  const handleAssign = async (epgChannelId: string) => {
    if (!mappingTarget || !selectedSource) return;
    await createMapping.mutateAsync({
      streamId: mappingTarget.stream.id,
      epgSourceId: selectedSource,
      epgChannelId,
    });
    setMappingTarget(null);
    setEpgSearch('');
  };

  const handleRemove = async (mappingId: string) => {
    await deleteMapping.mutateAsync(mappingId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Manuel EPG Eşleştirme</h1>
        <p className="text-sm text-muted mt-0.5">Her stream için EPG kanalını elle seçin</p>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="label text-xs">EPG Kaynağı</label>
          <select
            className="input"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            <option value="">Kaynak seçin…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label text-xs">Kategori</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Tüm Kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 min-w-48">
          <label className="label text-xs">Stream Ara</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              className="input pl-8"
              placeholder="Kanal adı…"
              value={streamSearch}
              onChange={(e) => setStreamSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stream list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
          </div>
        ) : streams.length === 0 ? (
          <div className="py-10 text-center text-muted text-sm">Kanal bulunamadı</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Kanal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Kategori</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">EPG Eşleştirmesi</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {streams.map((stream) => {
                const mapping = mappingByStream.get(stream.id);
                return (
                  <tr key={stream.id} className="border-b border-border/40 hover:bg-surface-2/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {stream.tvgLogo ? (
                          <img src={stream.tvgLogo} alt="" className="w-6 h-6 rounded object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : (
                          <div className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center text-[9px] text-muted font-bold">
                            {stream.name[0]}
                          </div>
                        )}
                        <span className="font-medium text-slate-200">{stream.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{stream.category?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {mapping ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <Link2 className="w-3 h-3" />
                            {mapping.epgChannelId}
                          </span>
                          {mapping.epgSource && (
                            <span className="text-[10px] text-muted">({mapping.epgSource.name})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Eşleştirilmedi</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {mapping ? (
                          <button
                            onClick={() => void handleRemove(mapping.id)}
                            disabled={deleteMapping.isPending}
                            className="btn btn-ghost py-1 px-2 text-xs text-danger"
                            title="Eşleştirmeyi Kaldır"
                          >
                            <Link2Off className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => setMappingTarget({ stream })}
                          disabled={!selectedSource}
                          className={cn(
                            'btn btn-ghost py-1 px-2 text-xs',
                            !selectedSource ? 'opacity-40 cursor-not-allowed' : 'text-primary',
                          )}
                          title={!selectedSource ? 'Önce EPG kaynağı seçin' : 'Eşleştir'}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!selectedSource && (
        <p className="text-xs text-amber-400 text-center">
          Eşleştirme yapmak için önce üstten bir EPG kaynağı seçin.
        </p>
      )}

      {/* Channel picker modal */}
      <Modal
        open={!!mappingTarget}
        onClose={() => { setMappingTarget(null); setEpgSearch(''); }}
        title={`EPG Eşleştir — ${mappingTarget?.stream.name ?? ''}`}
        size="md"
      >
        <div className="space-y-4 p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              className="input pl-8"
              placeholder="EPG kanalı ara…"
              value={epgSearch}
              onChange={(e) => setEpgSearch(e.target.value)}
              autoFocus
            />
          </div>

          {loadingChannels ? (
            <div className="flex items-center justify-center gap-2 py-6 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Kanallar yükleniyor…
            </div>
          ) : epgChannels.length === 0 ? (
            <div className="py-6 text-center text-muted text-sm">
              {epgSearch ? 'Sonuç bulunamadı' : 'Bu kaynakta kanal yok (önce parse edin)'}
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {epgChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => void handleAssign(ch.channelId)}
                  disabled={createMapping.isPending}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div>
                    <div className="text-sm text-slate-200 group-hover:text-white">{ch.displayName}</div>
                    <div className="text-[10px] text-muted font-mono">{ch.channelId}</div>
                  </div>
                  <Link2 className="w-3.5 h-3.5 text-muted group-hover:text-primary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => { setMappingTarget(null); setEpgSearch(''); }}
              className="btn btn-ghost text-sm flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Kapat
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
