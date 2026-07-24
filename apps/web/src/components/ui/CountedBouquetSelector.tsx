import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Tv, Film, Clapperboard, Check } from 'lucide-react';
import { useBouquets, useBouquetContentCounts } from '@/hooks/useBouquets';

/**
 * Roadmap B — içerik-sayılı buket seçici.
 * Her satır: checkbox · buket adı · Kanal / Film / Dizi adedi.
 */
export function CountedBouquetSelector({
  value,
  onChange,
  maxHeight = 320,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: number;
}) {
  const { t } = useTranslation();
  const { data: bouquets = [] } = useBouquets();
  const { data: counts = {} } = useBouquetContentCounts();
  const [q, setQ] = useState('');

  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(
    () => bouquets.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())),
    [bouquets, q],
  );
  const allVisibleSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange([...next]);
  }
  function toggleAllVisible() {
    const next = new Set(selected);
    if (allVisibleSelected) filtered.forEach((b) => next.delete(b.id));
    else filtered.forEach((b) => next.add(b.id));
    onChange([...next]);
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-2/50">
        <Search className="w-4 h-4 text-muted" />
        <input
          className="bg-transparent text-sm flex-1 outline-none"
          placeholder={t('bouquetSel.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-[11px] text-muted">{t('bouquetSel.selectedCount', { n: value.length })}</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-border text-muted text-xs">
              <th className="w-9 px-2 py-2">
                <button type="button" onClick={toggleAllVisible}
                  className={`w-4 h-4 rounded border flex items-center justify-center ${allVisibleSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                  {allVisibleSelected && <Check className="w-3 h-3 text-white" />}
                </button>
              </th>
              <th className="text-left font-normal px-2 py-2">{t('bouquetSel.name')}</th>
              <th className="font-normal px-2 py-2 text-right"><span className="inline-flex items-center gap-1 justify-end"><Tv className="w-3.5 h-3.5" /> {t('bouquetSel.live')}</span></th>
              <th className="font-normal px-2 py-2 text-right"><span className="inline-flex items-center gap-1 justify-end"><Film className="w-3.5 h-3.5" /> {t('bouquetSel.vod')}</span></th>
              <th className="font-normal px-2 py-2 text-right pr-3"><span className="inline-flex items-center gap-1 justify-end"><Clapperboard className="w-3.5 h-3.5" /> {t('bouquetSel.series')}</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const c = counts[b.id] ?? { live: 0, vod: 0, series: 0, total: 0 };
              const on = selected.has(b.id);
              return (
                <tr key={b.id}
                  onClick={() => toggle(b.id)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors ${on ? 'bg-primary/5' : 'hover:bg-surface-2/50'}`}>
                  <td className="px-2 py-2">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium">{b.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{c.live || '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted">{c.vod || '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted pr-3">{c.series || '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted text-xs">{t('bouquetSel.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
