import { useState } from 'react';
import { CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { TagInput } from '@/components/ui/TagInput';
import { useEPGSources, useMassAssignEPG } from '@/hooks/useEPG';
import { cn } from '@/lib/utils';

interface Result {
  matched: number;
  total: number;
}

export function EPGMassAssignPage() {
  const { data: sources = [] } = useEPGSources();
  const massAssign = useMassAssignEPG();

  const [selectedSource, setSelectedSource] = useState('');
  const [similarity, setSimilarity] = useState(60);
  const [stripPrefixes, setStripPrefixes] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const handleRun = async () => {
    if (!selectedSource) return;
    const res = await massAssign.mutateAsync({
      epgSourceId: selectedSource,
      minSimilarity: similarity / 100,
    });
    setResult(res.data.data);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Toplu EPG Eşleştirme</h1>
        <p className="text-sm text-muted mt-0.5">
          Kanal adlarını akıllı benzerlik algoritmasıyla otomatik eşleştir
        </p>
      </div>

      <div className="card p-6 space-y-5">
        {/* Source */}
        <div>
          <label className="label">EPG Kaynağı</label>
          <select
            className="input"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            <option value="">Kaynak seçin…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Similarity slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Minimum Benzerlik</label>
            <span className="text-sm font-semibold text-primary-light">%{similarity}</span>
          </div>
          <input
            type="range"
            min="30"
            max="100"
            step="5"
            value={similarity}
            onChange={(e) => setSimilarity(parseInt(e.target.value, 10))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted mt-0.5">
            <span>%30 (Gevşek)</span>
            <span>%100 (Kesin)</span>
          </div>
        </div>

        {/* Prefix strip */}
        <div>
          <label className="label">Kaldırılacak Önekler</label>
          <TagInput
            value={stripPrefixes}
            onChange={setStripPrefixes}
            placeholder="Ör: TR|, TR:, [TR]"
          />
          <p className="text-xs text-muted mt-1">
            Kanal adlarından önce kaldırılacak metinler (virgülle ayırın)
          </p>
        </div>

        <button
          onClick={() => void handleRun()}
          disabled={!selectedSource || massAssign.isPending}
          className="btn btn-primary w-full"
        >
          {massAssign.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor…</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Eşleştirmeyi Başlat</>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div
          className={cn(
            'card p-6 border',
            result.matched > 0 ? 'border-success/30 bg-success/5' : 'border-border',
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', result.matched > 0 ? 'bg-success/10' : 'bg-surface-2')}>
              <CheckCircle className={cn('w-5 h-5', result.matched > 0 ? 'text-success' : 'text-muted')} />
            </div>
            <div>
              <div className="font-semibold text-slate-200">Eşleştirme Tamamlandı</div>
              <div className="text-sm text-muted">{result.total} akıştan {result.matched} tanesi eşleştirildi</div>
            </div>
          </div>

          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-700"
              style={{ width: `${result.total > 0 ? (result.matched / result.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted mt-1.5">
            <span>{result.matched} eşleşti</span>
            <span>{result.total - result.matched} eşleşmedi</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface-2 rounded-xl p-3">
              <div className="text-xl font-bold text-slate-200">{result.total}</div>
              <div className="text-xs text-muted">Toplam Akış</div>
            </div>
            <div className="bg-success/10 rounded-xl p-3">
              <div className="text-xl font-bold text-success">{result.matched}</div>
              <div className="text-xs text-muted">Eşleşti</div>
            </div>
            <div className="bg-surface-2 rounded-xl p-3">
              <div className="text-xl font-bold text-slate-200">
                {result.total > 0 ? Math.round((result.matched / result.total) * 100) : 0}%
              </div>
              <div className="text-xs text-muted">Başarı</div>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Nasıl Çalışır?</div>
        <div className="space-y-2">
          {[
            'Tüm aktif akışların adları alınır',
            'EPG kanallarıyla Levenshtein mesafesi hesaplanır',
            'Belirlediğiniz eşiğin üzerindeki eşleşmeler otomatik kaydedilir',
            'Manuel düzenleme için EPG Kaynakları sayfasına dönebilirsiniz',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
              <ChevronRight className="w-3.5 h-3.5 text-primary-light mt-0.5 flex-shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
