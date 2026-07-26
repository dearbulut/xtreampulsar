import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  Star,
  Terminal,
  Layers,
  Lock,
} from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  useTranscodeProfiles,
  useTranscodeCodecs,
  useCreateTranscodeProfile,
  useUpdateTranscodeProfile,
  useDeleteTranscodeProfile,
  useCloneTranscodeProfile,
  useSetDefaultTranscodeProfile,
  usePreviewTranscodeProfile,
  type TranscodeProfile,
  type AbrVariant,
} from '@/hooks/useTranscodeProfiles';
import { cn } from '@/lib/utils';

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: string;
  videoCodec: string;
  videoPreset: string;
  videoBitrate: string;
  maxBitrate: string;
  bufSize: string;
  crf: string;
  width: string;
  height: string;
  fps: string;
  gopSize: string;
  pixFmt: string;
  videoProfile: string;
  videoTune: string;
  audioCodec: string;
  audioBitrate: string;
  audioChannels: string;
  audioRate: string;
  hlsSegmentSec: string;
  hlsListSize: string;
  hlsDeleteSegments: boolean;
  abrEnabled: boolean;
  abrVariants: AbrVariant[];
  hwAccel: string;
  threads: string;
  extraArgs: string;
}

const FORM_DEFAULT: FormState = {
  name: '',
  description: '',
  isActive: true,
  isDefault: false,
  sortOrder: '0',
  videoCodec: 'libx264',
  videoPreset: 'veryfast',
  videoBitrate: '',
  maxBitrate: '',
  bufSize: '',
  crf: '',
  width: '',
  height: '',
  fps: '',
  gopSize: '',
  pixFmt: 'yuv420p',
  videoProfile: '',
  videoTune: '',
  audioCodec: 'aac',
  audioBitrate: '',
  audioChannels: '',
  audioRate: '',
  hlsSegmentSec: '4',
  hlsListSize: '10',
  hlsDeleteSegments: true,
  abrEnabled: false,
  abrVariants: [],
  hwAccel: '',
  threads: '',
  extraArgs: '',
};

const num = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? undefined : n;
};
const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

function toForm(p: TranscodeProfile): FormState {
  return {
    name: p.name,
    description: p.description ?? '',
    isActive: p.isActive,
    isDefault: p.isDefault,
    sortOrder: String(p.sortOrder ?? 0),
    videoCodec: p.videoCodec ?? 'copy',
    videoPreset: p.videoPreset ?? '',
    videoBitrate: p.videoBitrate?.toString() ?? '',
    maxBitrate: p.maxBitrate?.toString() ?? '',
    bufSize: p.bufSize?.toString() ?? '',
    crf: p.crf?.toString() ?? '',
    width: p.width?.toString() ?? '',
    height: p.height?.toString() ?? '',
    fps: p.fps?.toString() ?? '',
    gopSize: p.gopSize?.toString() ?? '',
    pixFmt: p.pixFmt ?? '',
    videoProfile: p.videoProfile ?? '',
    videoTune: p.videoTune ?? '',
    audioCodec: p.audioCodec ?? 'copy',
    audioBitrate: p.audioBitrate?.toString() ?? '',
    audioChannels: p.audioChannels?.toString() ?? '',
    audioRate: p.audioRate?.toString() ?? '',
    hlsSegmentSec: String(p.hlsSegmentSec ?? 4),
    hlsListSize: String(p.hlsListSize ?? 10),
    hlsDeleteSegments: p.hlsDeleteSegments ?? true,
    abrEnabled: p.abrEnabled ?? false,
    abrVariants: Array.isArray(p.abrVariants) ? p.abrVariants : [],
    hwAccel: p.hwAccel ?? '',
    threads: p.threads?.toString() ?? '',
    extraArgs: p.extraArgs ?? '',
  };
}

export function TranscodeProfilesPage() {
  const { t } = useTranslation();
  const { data: profiles = [], isLoading } = useTranscodeProfiles();
  const { data: codecs } = useTranscodeCodecs();

  const createProfile = useCreateTranscodeProfile();
  const updateProfile = useUpdateTranscodeProfile();
  const deleteProfile = useDeleteTranscodeProfile();
  const cloneProfile = useCloneTranscodeProfile();
  const setDefault = useSetDefaultTranscodeProfile();
  const preview = usePreviewTranscodeProfile();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<TranscodeProfile | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [previewFor, setPreviewFor] = useState<TranscodeProfile | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const videoCodecs = codecs?.videoCodecs ?? ['copy', 'none', 'libx264'];
  const audioCodecs = codecs?.audioCodecs ?? ['copy', 'none', 'aac'];
  const presets = codecs?.presets ?? ['veryfast'];
  const hwAccels = codecs?.hwAccels ?? [''];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));
  const fi = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const videoOff = form.videoCodec === 'none';
  const videoCopy = form.videoCodec === 'copy';
  const audioOff = form.audioCodec === 'none';
  const audioCopy = form.audioCodec === 'copy';

  const openAdd = () => {
    setForm(FORM_DEFAULT);
    setEditTarget(null);
    setShowModal(true);
  };
  const openEdit = (p: TranscodeProfile) => {
    setForm(toForm(p));
    setEditTarget(p);
    setShowModal(true);
  };

  const buildPayload = (): Partial<TranscodeProfile> => ({
    name: form.name.trim(),
    description: str(form.description) ?? null,
    isActive: form.isActive,
    isDefault: form.isDefault,
    sortOrder: num(form.sortOrder) ?? 0,
    videoCodec: form.videoCodec,
    videoPreset: str(form.videoPreset) ?? null,
    videoBitrate: num(form.videoBitrate) ?? null,
    maxBitrate: num(form.maxBitrate) ?? null,
    bufSize: num(form.bufSize) ?? null,
    crf: num(form.crf) ?? null,
    width: num(form.width) ?? null,
    height: num(form.height) ?? null,
    fps: num(form.fps) ?? null,
    gopSize: num(form.gopSize) ?? null,
    pixFmt: str(form.pixFmt) ?? null,
    videoProfile: str(form.videoProfile) ?? null,
    videoTune: str(form.videoTune) ?? null,
    audioCodec: form.audioCodec,
    audioBitrate: num(form.audioBitrate) ?? null,
    audioChannels: num(form.audioChannels) ?? null,
    audioRate: num(form.audioRate) ?? null,
    hlsSegmentSec: num(form.hlsSegmentSec) ?? 4,
    hlsListSize: num(form.hlsListSize) ?? 10,
    hlsDeleteSegments: form.hlsDeleteSegments,
    abrEnabled: form.abrEnabled,
    abrVariants: form.abrEnabled ? form.abrVariants : null,
    hwAccel: str(form.hwAccel) ?? null,
    threads: num(form.threads) ?? null,
    extraArgs: str(form.extraArgs) ?? null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (editTarget) {
      // Sistem profillerinde ad degistirilemez — gondermeyelim.
      if (editTarget.isSystem) delete (payload as { name?: string }).name;
      await updateProfile.mutateAsync({ id: editTarget.id, data: payload });
    } else {
      await createProfile.mutateAsync(payload);
    }
    setShowModal(false);
  };

  const handleDelete = async (p: TranscodeProfile) => {
    if (!confirm(t('transcode.deleteConfirm', { name: p.name }))) return;
    await deleteProfile.mutateAsync(p.id);
  };

  const openPreview = (p: TranscodeProfile) => {
    setPreviewFor(p);
    setPreviewUrl('');
    preview.mutate({ id: p.id });
  };

  const summary = (p: TranscodeProfile) => {
    if (p.abrEnabled) {
      const n = Array.isArray(p.abrVariants) ? p.abrVariants.length : 0;
      return t('transcode.abrSummary', { count: n });
    }
    if (p.videoCodec === 'copy') return t('transcode.passthrough');
    if (p.videoCodec === 'none') return t('transcode.audioOnly');
    const res = p.width && p.height ? `${p.width}x${p.height}` : p.height ? `${p.height}p` : '';
    const br = p.videoBitrate ? `${p.videoBitrate}k` : '';
    return [p.videoCodec, res, br].filter(Boolean).join(' · ');
  };

  const columns: Column<TranscodeProfile>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('transcode.colProfile'),
        render: (row) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-slate-200 flex items-center gap-1.5">
                {row.name}
                {row.isDefault && (
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                )}
                {row.isSystem && <Lock className="w-3 h-3 text-slate-500" />}
              </div>
              {row.description && (
                <div className="text-xs text-muted truncate max-w-[240px]">
                  {row.description}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'summary',
        header: t('transcode.colVideo'),
        render: (row) => (
          <span className="text-sm text-slate-300">{summary(row)}</span>
        ),
      },
      {
        key: 'audio',
        header: t('transcode.colAudio'),
        render: (row) => (
          <span className="text-sm text-slate-400">
            {row.audioCodec === 'copy'
              ? t('transcode.passthrough')
              : row.audioCodec === 'none'
                ? t('transcode.noAudio')
                : [row.audioCodec, row.audioBitrate ? `${row.audioBitrate}k` : '']
                    .filter(Boolean)
                    .join(' · ')}
          </span>
        ),
      },
      {
        key: 'hls',
        header: 'HLS',
        render: (row) => (
          <span className="text-xs text-muted">
            {row.hlsSegmentSec}s / {row.hlsListSize}
          </span>
        ),
      },
      {
        key: 'streams',
        header: t('transcode.colStreams'),
        render: (row) => (
          <span className="text-sm font-semibold text-blue-400">
            {row._count?.streams ?? 0}
          </span>
        ),
      },
      {
        key: 'isActive',
        header: t('common.status'),
        render: (row) => (
          <span className={cn('badge', row.isActive ? 'badge-success' : 'badge-gray')}>
            {row.isActive ? t('common.active') : t('common.inactive')}
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
              className="btn btn-ghost p-1.5"
              title={t('transcode.preview')}
              onClick={(e) => {
                e.stopPropagation();
                openPreview(row);
              }}
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            </button>
            <button
              className="btn btn-ghost p-1.5"
              title={t('transcode.setDefault')}
              onClick={(e) => {
                e.stopPropagation();
                setDefault.mutate(row.id);
              }}
              disabled={row.isDefault || setDefault.isPending}
            >
              <Star
                className={cn(
                  'w-3.5 h-3.5',
                  row.isDefault ? 'text-amber-400 fill-amber-400' : 'text-slate-400',
                )}
              />
            </button>
            <button
              className="btn btn-ghost p-1.5"
              title={t('common.clone')}
              onClick={(e) => {
                e.stopPropagation();
                cloneProfile.mutate(row.id);
              }}
              disabled={cloneProfile.isPending}
            >
              <Copy className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            <button
              className="btn btn-ghost p-1.5"
              title={t('common.edit')}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn btn-ghost p-1.5 hover:text-danger disabled:opacity-30"
              title={row.isSystem ? t('transcode.systemLocked') : t('common.delete')}
              disabled={row.isSystem}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(row);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, cloneProfile.isPending, setDefault.isPending],
  );

  const addVariant = () =>
    set('abrVariants', [
      ...form.abrVariants,
      { name: '720p', width: 1280, height: 720, videoBitrate: 2800, audioBitrate: 128 },
    ]);
  const patchVariant = (i: number, patch: Partial<AbrVariant>) =>
    set(
      'abrVariants',
      form.abrVariants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    );
  const removeVariant = (i: number) =>
    set('abrVariants', form.abrVariants.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {t('transcode.title')}
          </h1>
          <p className="text-sm text-muted mt-0.5">{t('transcode.subtitle')}</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> {t('transcode.addProfile')}
        </button>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/80">
        {t('transcode.notice')}
      </div>

      <DataTable
        columns={columns}
        data={profiles}
        isLoading={isLoading}
        emptyMessage={t('transcode.empty')}
      />

      {/* ─── Profil formu ─── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? t('transcode.editProfile') : t('transcode.addProfile')}
        size="2xl"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">{t('common.name')}</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={fi('name')}
                disabled={editTarget?.isSystem}
                placeholder="1080p H.264"
              />
              {editTarget?.isSystem && (
                <p className="text-[11px] text-muted mt-1">
                  {t('transcode.systemNameLocked')}
                </p>
              )}
            </div>
            <div>
              <label className="label">{t('common.sortOrder')}</label>
              <input
                type="number"
                className="input"
                value={form.sortOrder}
                onChange={fi('sortOrder')}
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">{t('common.description')}</label>
              <input
                className="input"
                value={form.description}
                onChange={fi('description')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
              />
              {t('common.active')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => set('isDefault', e.target.checked)}
              />
              {t('transcode.isDefault')}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.abrEnabled}
                onChange={(e) => set('abrEnabled', e.target.checked)}
              />
              {t('transcode.abrEnabled')}
            </label>
          </div>

          {/* Video */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">
              {t('transcode.videoSection')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">{t('transcode.videoCodec')}</label>
                <select className="input" value={form.videoCodec} onChange={fi('videoCodec')}>
                  {videoCodecs.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('transcode.hwAccel')}</label>
                <select className="input" value={form.hwAccel} onChange={fi('hwAccel')}>
                  {hwAccels.map((c) => (
                    <option key={c || 'none'} value={c}>{c || t('common.none')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('transcode.preset')}</label>
                <select
                  className="input"
                  value={form.videoPreset}
                  onChange={fi('videoPreset')}
                  disabled={videoCopy || videoOff}
                >
                  <option value="">-</option>
                  {presets.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('transcode.threads')}</label>
                <input type="number" className="input" value={form.threads} onChange={fi('threads')} placeholder="0" />
              </div>
            </div>

            {!videoCopy && !videoOff && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">{t('transcode.videoBitrate')}</label>
                  <input type="number" className="input" value={form.videoBitrate} onChange={fi('videoBitrate')} placeholder="5000" />
                </div>
                <div>
                  <label className="label">{t('transcode.maxBitrate')}</label>
                  <input type="number" className="input" value={form.maxBitrate} onChange={fi('maxBitrate')} placeholder="5350" />
                </div>
                <div>
                  <label className="label">{t('transcode.bufSize')}</label>
                  <input type="number" className="input" value={form.bufSize} onChange={fi('bufSize')} placeholder="7500" />
                </div>
                <div>
                  <label className="label">CRF</label>
                  <input type="number" className="input" value={form.crf} onChange={fi('crf')} placeholder="23" />
                </div>
                <div>
                  <label className="label">{t('transcode.width')}</label>
                  <input type="number" className="input" value={form.width} onChange={fi('width')} placeholder="1920" />
                </div>
                <div>
                  <label className="label">{t('transcode.height')}</label>
                  <input type="number" className="input" value={form.height} onChange={fi('height')} placeholder="1080" />
                </div>
                <div>
                  <label className="label">FPS</label>
                  <input type="number" className="input" value={form.fps} onChange={fi('fps')} placeholder="30" />
                </div>
                <div>
                  <label className="label">{t('transcode.gopSize')}</label>
                  <input type="number" className="input" value={form.gopSize} onChange={fi('gopSize')} placeholder="60" />
                </div>
                <div>
                  <label className="label">pix_fmt</label>
                  <input className="input" value={form.pixFmt} onChange={fi('pixFmt')} placeholder="yuv420p" />
                </div>
                <div>
                  <label className="label">{t('transcode.videoProfile')}</label>
                  <input className="input" value={form.videoProfile} onChange={fi('videoProfile')} placeholder="high" />
                </div>
                <div>
                  <label className="label">tune</label>
                  <input className="input" value={form.videoTune} onChange={fi('videoTune')} placeholder="zerolatency" />
                </div>
              </div>
            )}
          </div>

          {/* Audio */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">
              {t('transcode.audioSection')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="label">{t('transcode.audioCodec')}</label>
                <select className="input" value={form.audioCodec} onChange={fi('audioCodec')}>
                  {audioCodecs.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{t('transcode.audioBitrate')}</label>
                <input type="number" className="input" value={form.audioBitrate} onChange={fi('audioBitrate')} placeholder="128" disabled={audioCopy || audioOff} />
              </div>
              <div>
                <label className="label">{t('transcode.audioChannels')}</label>
                <input type="number" className="input" value={form.audioChannels} onChange={fi('audioChannels')} placeholder="2" disabled={audioCopy || audioOff} />
              </div>
              <div>
                <label className="label">{t('transcode.audioRate')}</label>
                <input type="number" className="input" value={form.audioRate} onChange={fi('audioRate')} placeholder="48000" disabled={audioCopy || audioOff} />
              </div>
            </div>
          </div>

          {/* HLS */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">HLS</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="label">{t('transcode.hlsSegmentSec')}</label>
                <input type="number" className="input" value={form.hlsSegmentSec} onChange={fi('hlsSegmentSec')} />
              </div>
              <div>
                <label className="label">{t('transcode.hlsListSize')}</label>
                <input type="number" className="input" value={form.hlsListSize} onChange={fi('hlsListSize')} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
                <input
                  type="checkbox"
                  checked={form.hlsDeleteSegments}
                  onChange={(e) => set('hlsDeleteSegments', e.target.checked)}
                />
                {t('transcode.hlsDeleteSegments')}
              </label>
            </div>
          </div>

          {/* ABR */}
          {form.abrEnabled && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t('transcode.abrSection')}
                </h3>
                <button type="button" className="btn btn-ghost text-xs" onClick={addVariant}>
                  <Plus className="w-3.5 h-3.5" /> {t('transcode.addVariant')}
                </button>
              </div>
              {form.abrVariants.length === 0 && (
                <p className="text-xs text-muted">{t('transcode.noVariants')}</p>
              )}
              {form.abrVariants.map((v, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                  <div>
                    <label className="label">{t('common.name')}</label>
                    <input className="input" value={v.name ?? ''} onChange={(e) => patchVariant(i, { name: e.target.value })} placeholder="720p" />
                  </div>
                  <div>
                    <label className="label">{t('transcode.width')}</label>
                    <input type="number" className="input" value={v.width ?? ''} onChange={(e) => patchVariant(i, { width: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className="label">{t('transcode.height')}</label>
                    <input type="number" className="input" value={v.height ?? ''} onChange={(e) => patchVariant(i, { height: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className="label">{t('transcode.videoBitrate')}</label>
                    <input type="number" className="input" value={v.videoBitrate ?? ''} onChange={(e) => patchVariant(i, { videoBitrate: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <label className="label">{t('transcode.audioBitrate')}</label>
                    <input type="number" className="input" value={v.audioBitrate ?? ''} onChange={(e) => patchVariant(i, { audioBitrate: Number(e.target.value) || undefined })} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost p-1.5 hover:text-danger mb-0.5"
                    onClick={() => removeVariant(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="label">{t('transcode.extraArgs')}</label>
            <input
              className="input font-mono text-xs"
              value={form.extraArgs}
              onChange={fi('extraArgs')}
              placeholder="-sc_threshold 0 -force_key_frames expr:gte(t,n_forced*2)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createProfile.isPending || updateProfile.isPending}
            >
              {editTarget ? t('common.update') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Komut onizleme ─── */}
      <Modal
        open={!!previewFor}
        onClose={() => setPreviewFor(null)}
        title={t('transcode.previewTitle', { name: previewFor?.name ?? '' })}
        description={t('transcode.previewDesc')}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-xs"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder={t('transcode.previewUrlPlaceholder')}
            />
            <button
              className="btn btn-secondary"
              onClick={() =>
                previewFor &&
                preview.mutate({ id: previewFor.id, inputUrl: previewUrl || undefined })
              }
              disabled={preview.isPending}
            >
              {t('transcode.refresh')}
            </button>
          </div>
          <pre className="rounded-xl bg-black/50 border border-border p-4 text-[11px] leading-relaxed text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all">
            {preview.isPending
              ? '...'
              : (preview.data?.command ?? t('transcode.previewEmpty'))}
          </pre>
          {preview.data?.variantDirs?.length ? (
            <p className="text-xs text-muted">
              {t('transcode.variantDirs')}: {preview.data.variantDirs.join(', ')}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
