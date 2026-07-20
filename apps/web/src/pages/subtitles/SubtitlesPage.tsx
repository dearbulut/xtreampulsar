import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Download, Save, Captions, Loader2, Ear } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSubtitleConfig, useUpdateSubtitleConfig, useSearchSubtitles, downloadSubtitle, type SubtitleResult } from '@/hooks/useSubtitles';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const LANGS = ['en', 'tr', 'de', 'ar', 'fr', 'es', 'it', 'ru', 'pt', 'nl', 'pl', 'fa'];

export function SubtitlesPage() {
  const { t } = useTranslation();
  const { data: cfg } = useSubtitleConfig();
  const update = useUpdateSubtitleConfig();
  const search = useSearchSubtitles();

  const [form, setForm] = useState<{ enabled: boolean; apiKey: string; username: string; password: string } | null>(null);
  const c = form ?? (cfg ? { enabled: cfg.enabled, apiKey: cfg.apiKey, username: cfg.username, password: '' } : null);

  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('en');
  const [results, setResults] = useState<SubtitleResult[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);

  const saveConfig = () => {
    if (!c) return;
    update.mutate(
      { enabled: c.enabled, apiKey: c.apiKey, username: c.username, ...(c.password ? { password: c.password } : {}) },
      { onSuccess: () => { toast.success(t('common.saved')); setForm((f) => (f ? { ...f, password: '' } : f)); } },
    );
  };

  const doSearch = () => {
    if (!query.trim()) return;
    search.mutate({ query: query.trim(), languages: lang }, {
      onSuccess: (r) => setResults(r),
      onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('common.error')),
    });
  };

  const doDownload = async (r: SubtitleResult) => {
    if (!r.fileId) return;
    setDownloading(r.fileId);
    try {
      await downloadSubtitle(r.fileId, r.release);
      toast.success(t('subtitles.downloaded'));
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t('subtitles.downloadError'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader title={t('subtitles.title')} description={t('subtitles.subtitle')} />

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Captions className="w-4 h-4 text-primary" /> {t('subtitles.providerTitle')}</div>
          {c && (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted">{c.enabled ? t('subtitles.on') : t('subtitles.off')}</span>
              <input type="checkbox" className="toggle" checked={c.enabled} onChange={(e) => setForm({ ...c, enabled: e.target.checked })} />
            </label>
          )}
        </div>
        <p className="text-xs text-muted mb-4">{t('subtitles.providerHint')}</p>
        {c && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">{t('subtitles.apiKey')}</label>
                <input className="input" value={c.apiKey} onChange={(e) => setForm({ ...c, apiKey: e.target.value })} placeholder="OpenSubtitles API Key" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t('subtitles.username')}</label>
                <input className="input" value={c.username} onChange={(e) => setForm({ ...c, username: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{t('subtitles.password')} {cfg?.passwordSet && <span className="text-success">✓</span>}</label>
                <input type="password" className="input" value={c.password} onChange={(e) => setForm({ ...c, password: e.target.value })} placeholder={cfg?.passwordSet ? '••••••' : ''} />
              </div>
            </div>
            <button className="btn-primary mt-4 inline-flex items-center gap-1.5" disabled={update.isPending} onClick={saveConfig}>
              <Save className="w-3.5 h-3.5" /> {update.isPending ? t('common.loading') : t('common.save')}
            </button>
          </>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input className="input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }} placeholder={t('subtitles.searchPlaceholder')} />
          <select className="input sm:w-32" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <button className="btn-primary inline-flex items-center gap-1.5 justify-center" disabled={search.isPending || !query.trim()} onClick={doSearch}>
            {search.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {t('subtitles.search')}
          </button>
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">{search.isPending ? t('common.loading') : t('subtitles.noResults')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-3 py-2">{t('subtitles.language')}</th>
                <th className="px-3 py-2">{t('subtitles.release')}</th>
                <th className="px-3 py-2">{t('subtitles.downloads')}</th>
                <th className="px-3 py-2 text-right">{t('common.actions')}</th>
              </tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.fileId}-${i}`} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-3 py-2"><span className="badge bg-primary/10 text-primary uppercase">{r.language || '—'}</span>{r.hearingImpaired && <Ear className="inline w-3.5 h-3.5 ml-1.5 text-muted" />}</td>
                    <td className="px-3 py-2 text-muted truncate max-w-[360px]" title={r.release}>{r.release || '—'}</td>
                    <td className="px-3 py-2 text-muted">{r.downloads.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button className="btn-ghost p-1.5 disabled:opacity-40" disabled={!r.fileId || downloading === r.fileId} title={t('subtitles.download')} onClick={() => doDownload(r)}>
                        {downloading === r.fileId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className={cn('w-4 h-4', r.fileId ? 'text-primary' : 'text-muted')} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
