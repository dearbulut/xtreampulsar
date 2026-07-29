import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import {
  previewBulkUpdate,
  useBulkUpdateStreams,
  type BulkStreamData,
  type BulkStreamFilter,
} from '@/hooks/useMetadata';
import { useTranscodeProfileOptions } from '@/hooks/useTranscodeProfiles';

/**
 * Toplu duzenleme modali.
 *
 * Iki calisma kipi var:
 *   - "selected": ekranda checkbox ile secilen yayinlar.
 *   - "filter":   o an uygulanan filtreye uyan TUM yayinlar. 14 bin kanali
 *                 sayfa sayfa secmek mumkun olmadigi icin asil kip budur;
 *                 sunucu tarafinda tek updateMany'e cevrilir.
 *
 * Her alanin basinda bir "bunu degistir" kutusu var. Isaretlenmeyen alan
 * istege HIC eklenmez, yani mevcut degerine dokunulmaz. Boylece "sadece
 * yayin modunu degistir, kategoriyi elleme" mumkun olur.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  /** Yayin listesinde o an uygulanan filtre. */
  filter: BulkStreamFilter;
  /** Filtreye uyan toplam kayit (liste sorgusundan gelen `total`). */
  totalMatching: number;
  categories: Array<{ id: string; name: string }>;
}

type Scope = 'selected' | 'filter';

/** Hangi alanlarin gonderilecegini tutan ac/kapa durumu. */
interface Touched {
  streamMode: boolean;
  transcodeProfileId: boolean;
  categoryId: boolean;
  isActive: boolean;
  streamUserAgent: boolean;
  httpHeaders: boolean;
  httpCookie: boolean;
}

const NO_TOUCH: Touched = {
  streamMode: false,
  transcodeProfileId: false,
  categoryId: false,
  isActive: false,
  streamUserAgent: false,
  httpHeaders: false,
  httpCookie: false,
};

interface FormState {
  streamMode: string;
  transcodeProfileId: string;
  categoryId: string;
  isActive: boolean;
  streamUserAgent: string;
  httpHeaders: string;
  httpCookie: string;
}

const EMPTY_FORM: FormState = {
  streamMode: 'TRANSCODE',
  transcodeProfileId: '',
  categoryId: '',
  isActive: true,
  streamUserAgent: '',
  httpHeaders: '',
  httpCookie: '',
};

export function BulkEditModal({ open, onClose, selectedIds, filter, totalMatching, categories }: Props) {
  const { t } = useTranslation();
  const bulkUpdate = useBulkUpdateStreams();
  const { data: profiles } = useTranscodeProfileOptions();

  const [scope, setScope] = useState<Scope>(selectedIds.length > 0 ? 'selected' : 'filter');
  const [touched, setTouched] = useState<Touched>(NO_TOUCH);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [matched, setMatched] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Modal her acildiginda temiz baslasin; yanlislikla onceki secim uygulanmasin.
  useEffect(() => {
    if (!open) return;
    setTouched(NO_TOUCH);
    setForm(EMPTY_FORM);
    setMatched(null);
    setConfirming(false);
    setScope(selectedIds.length > 0 ? 'selected' : 'filter');
  }, [open, selectedIds.length]);

  /** Sunucuya gidecek `data`: yalnizca isaretlenmis alanlar. */
  const data = useMemo<BulkStreamData>(() => {
    const d: BulkStreamData = {};
    if (touched.streamMode) d.streamMode = form.streamMode;
    if (touched.transcodeProfileId) d.transcodeProfileId = form.transcodeProfileId;
    if (touched.categoryId && form.categoryId) d.categoryId = form.categoryId;
    if (touched.isActive) d.isActive = form.isActive;
    if (touched.streamUserAgent) d.streamUserAgent = form.streamUserAgent;
    if (touched.httpHeaders) d.httpHeaders = form.httpHeaders;
    if (touched.httpCookie) d.httpCookie = form.httpCookie;
    return d;
  }, [touched, form]);

  const activeFilter = useMemo<BulkStreamFilter>(() => {
    const f: BulkStreamFilter = {};
    (Object.keys(filter) as Array<keyof BulkStreamFilter>).forEach((k) => {
      const v = filter[k];
      if (v !== undefined && v !== null && v !== '') {
        (f as Record<string, unknown>)[k] = v;
      }
    });
    return f;
  }, [filter]);

  const nothingToDo = Object.keys(data).length === 0;
  const targetCount = scope === 'selected' ? selectedIds.length : totalMatching;
  const wholeCatalog = scope === 'filter' && Object.keys(activeFilter).length === 0;

  const payload = () =>
    scope === 'selected'
      ? { streamIds: selectedIds, data }
      : { filter: activeFilter, confirmAll: wholeCatalog, data };

  /** Once kuru calistirma: kac kayit etkilenecek? Onay ekraninda gosterilir. */
  const handlePreview = async () => {
    try {
      const n = await previewBulkUpdate(payload());
      setMatched(n);
      setConfirming(true);
    } catch {
      setMatched(null);
      setConfirming(false);
    }
  };

  const handleApply = async () => {
    await bulkUpdate.mutateAsync(payload());
    onClose();
  };

  const row = (
    key: keyof Touched,
    label: string,
    control: React.ReactNode,
    hint?: string,
  ) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <input
        type="checkbox"
        className="accent-indigo-500 mt-1.5"
        checked={touched[key]}
        onChange={(e) => {
          setTouched((s) => ({ ...s, [key]: e.target.checked }));
          setConfirming(false);
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-fg mb-1">{label}</div>
        <div className={touched[key] ? '' : 'opacity-40 pointer-events-none'}>{control}</div>
        {hint ? <div className="text-xs text-muted mt-1">{hint}</div> : null}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('streams.bulkEditTitle', 'Toplu duzenleme')}
      description={t(
        'streams.bulkEditHint',
        'Yalnizca isaretledigin alanlar gonderilir; digerlerine dokunulmaz.',
      )}
      size="xl"
    >
      {/* Kapsam */}
      <div className="pb-4 mb-2 border-b border-border space-y-2">
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            className="accent-indigo-500"
            checked={scope === 'selected'}
            disabled={selectedIds.length === 0}
            onChange={() => {
              setScope('selected');
              setConfirming(false);
            }}
          />
          {t('streams.bulkScopeSelected', 'Secili yayinlar')} ({selectedIds.length})
        </label>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="radio"
            className="accent-indigo-500"
            checked={scope === 'filter'}
            onChange={() => {
              setScope('filter');
              setConfirming(false);
            }}
          />
          {t('streams.bulkScopeFilter', 'Filtreye uyan tum yayinlar')} ({totalMatching})
        </label>
        {wholeCatalog ? (
          <div className="text-xs text-amber-400">
            {t('streams.bulkScopeAllWarn', 'Hicbir filtre yok: islem TUM katalogu kapsar.')}
          </div>
        ) : null}
      </div>

      {/* Alanlar */}
      <div>
        {row(
          'streamMode',
          t('streams.streamMode', 'Yayin modu'),
          <select
            className="input w-full"
            value={form.streamMode}
            onChange={(e) => setForm((f) => ({ ...f, streamMode: e.target.value }))}
          >
            <option value="PROXY">PROXY</option>
            <option value="TRANSCODE">TRANSCODE (FFmpeg)</option>
            <option value="LOOP">LOOP</option>
          </select>,
          t(
            'streams.bulkModeHint',
            'TRANSCODE: kaynaga tek baglanti acilir, N izleyici onu paylasir. PROXY: her izleyici ayri bir upstream baglanti tuketir.',
          ),
        )}

        {row(
          'transcodeProfileId',
          t('streams.transcodeProfile', 'Transcode profili'),
          <select
            className="input w-full"
            value={form.transcodeProfileId}
            onChange={(e) => setForm((f) => ({ ...f, transcodeProfileId: e.target.value }))}
          >
            <option value="">{t('streams.bulkProfileNone', '- profil yok (kaldir) -')}</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>,
          t('streams.bulkProfileHint', 'Profil yoksa FFmpeg kopyalama (copy) kullanilir.'),
        )}

        {row(
          'categoryId',
          t('streams.category', 'Kategori'),
          <select
            className="input w-full"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">{t('common.select', 'Sec...')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>,
        )}

        {row(
          'isActive',
          t('streams.status', 'Durum'),
          <select
            className="input w-full"
            value={form.isActive ? '1' : '0'}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === '1' }))}
          >
            <option value="1">{t('common.active', 'Aktif')}</option>
            <option value="0">{t('common.inactive', 'Pasif')}</option>
          </select>,
        )}

        {row(
          'streamUserAgent',
          'User-Agent',
          <input
            className="input w-full"
            value={form.streamUserAgent}
            placeholder="VLC/3.0.20 LibVLC/3.0.20"
            onChange={(e) => setForm((f) => ({ ...f, streamUserAgent: e.target.value }))}
          />,
          t('streams.bulkUaHint', 'Bos birakilirsa alan temizlenir.'),
        )}

        {row(
          'httpHeaders',
          t('streams.httpHeaders', 'Ek HTTP basliklari'),
          <textarea
            className="input w-full h-20 font-mono text-xs"
            value={form.httpHeaders}
            placeholder={'Referer: https://ornek.com\nX-Token: abc'}
            onChange={(e) => setForm((f) => ({ ...f, httpHeaders: e.target.value }))}
          />,
          t('streams.bulkHeadersHint', 'Her satir "Anahtar: Deger" biciminde.'),
        )}

        {row(
          'httpCookie',
          'Cookie',
          <input
            className="input w-full font-mono text-xs"
            value={form.httpCookie}
            onChange={(e) => setForm((f) => ({ ...f, httpCookie: e.target.value }))}
          />,
        )}
      </div>

      {/* Onay + aksiyonlar */}
      <div className="pt-4 mt-2 border-t border-border">
        {confirming ? (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            {t('streams.bulkConfirm', {
              defaultValue: '{{n}} yayin guncellenecek. Onayliyor musun?',
              n: matched ?? targetCount,
            })}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            {t('common.cancel', 'Vazgec')}
          </button>
          {confirming ? (
            <button
              className="btn-primary"
              disabled={bulkUpdate.isPending}
              onClick={() => void handleApply()}
            >
              {t('common.apply', 'Uygula')}
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={nothingToDo || targetCount === 0}
              onClick={() => void handlePreview()}
            >
              {t('streams.bulkPreview', 'Devam')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default BulkEditModal;
