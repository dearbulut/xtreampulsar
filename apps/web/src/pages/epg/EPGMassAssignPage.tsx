import { useState } from 'react';
import { CheckCircle, Loader2, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { TagInput } from '@/components/ui/TagInput';
import { useEPGSources, useMassAssignEPG, useMassAssignJobStatus } from '@/hooks/useEPG';
import { cn } from '@/lib/utils';

export function EPGMassAssignPage() {
  const { data: sources = [] } = useEPGSources();
  const massAssign = useMassAssignEPG();

  const [selectedSource, setSelectedSource] = useState('');
  const [similarity, setSimilarity] = useState(60);
  const [stripPrefixes, setStripPrefixes] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: job } = useMassAssignJobStatus(jobId);

  const handleRun = async () => {
    if (!selectedSource) return;
    const res = await massAssign.mutateAsync({
      epgSourceId: selectedSource,
      minSimilarity: similarity / 100,
      stripPrefixes: stripPrefixes.length > 0 ? stripPrefixes : undefined,
    });
    setJobId(res.data.data.jobId);
  };

  const isDone = job?.status === 'done';
  const isFailed = job?.status === 'failed';
  const isProcessing = job?.status === 'processing' || massAssign.isPending;

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
            disabled={isProcessing}
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
            disabled={isProcessing}
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
            Kanal adlarından kaldırılacak önekler (eşleştirme öncesi temizlenir)
          </p>
        </div>

        <button
          onClick={() => void handleRun()}
          disabled={!selectedSource || isProcessing}
          className="btn btn-primary w-full"
        >
          {isProcessing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> İşleniyor…</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Eşleştirmeyi Başlat</>
          )}
        </button>
      </div>

      {/* Job status */}
      {job && (
        <div
          className={cn(
            'card p-6 border',
            isDone && 'border-success/30 bg-success/5',
            isFailed && 'border-danger/30 bg-danger/5',
            isProcessing && 'border-primary/20',
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              isDone ? 'bg-success/10' : isFailed ? 'bg-danger/10' : 'bg-primary/10',
            )}>
              {isDone && <CheckCircle className="w-5 h-5 text-success" />}
              {isFailed && <AlertTriangle className="w-5 h-5 text-danger" />}
              {isProcessing && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            </div>
            <div>
              <div className="font-semibold text-slate-200">
                {isDone && 'Eşleştirme Tamamlandı'}
                {isFailed && 'Eşleştirme Başarısız'}
                {isProcessing && 'Arka Planda İşleniyor…'}
              </div>
              <div className="text-sm text-muted">
                {isDone && `${job.total ?? 0} akıştan ${job.matched ?? 0} tanesi eşleştirildi`}
                {isFailed && (job.error ?? 'Bilinmeyen hata')}
                {isProcessing && job.total != null && `${job.matched ?? 0} / ${job.total} işlendi`}
                {isProcessing && job.total == null && 'Veriler yükleniyor…'}
              </div>
            </div>
          </div>

          {isDone && (job.total ?? 0) > 0 && (
            <>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-700"
                  style={{ width: `${((job.matched ?? 0) / (job.total ?? 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1.5">
                <span>{job.matched ?? 0} eşleşti</span>
                <span>{(job.total ?? 0) - (job.matched ?? 0)} eşleşmedi</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-surface-2 rounded-xl p-3">
                  <div className="text-xl font-bold text-slate-200">{job.total ?? 0}</div>
                  <div className="text-xs text-muted">Toplam Akış</div>
                </div>
                <div className="bg-success/10 rounded-xl p-3">
                  <div className="text-xl font-bold text-success">{job.matched ?? 0}</div>
                  <div className="text-xs text-muted">Eşleşti</div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3">
                  <div className="text-xl font-bold text-slate-200">
                    {(job.total ?? 0) > 0 ? Math.round(((job.matched ?? 0) / (job.total ?? 1)) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted">Başarı</div>
                </div>
              </div>
            </>
          )}

          {isProcessing && job.total != null && (
            <div className="mt-2">
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${job.total > 0 ? ((job.matched ?? 0) / job.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {job.finishedAt && (
            <div className="flex items-center gap-1 mt-3 text-xs text-muted">
              <Clock className="w-3 h-3" />
              {new Date(job.finishedAt).toLocaleTimeString('tr-TR')} tamamlandı
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Nasıl Çalışır?</div>
        <div className="space-y-2">
          {[
            'Eşleştirme arka planda başlar, sayfa bloklanmaz',
            'Aktif akışlar 500\'erli gruplar hâlinde işlenir',
            'EPG kanallarıyla Levenshtein mesafesi hesaplanır',
            'Belirlediğiniz eşiğin üzerindeki eşleşmeler otomatik kaydedilir',
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
