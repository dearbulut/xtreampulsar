import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  Search,
  RotateCcw,
  Pencil,
  Square,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Tv,
  Play,
  Microscope,
  Copy,
  Sparkles,
  FolderInput,
  GripVertical,
  Filter,
  Clapperboard,
  X,
  Activity,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Film,
  ListVideo,
  AudioLines,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStreamHealth, useManualHealthCheck } from '@/hooks/useStreamHealth';
import { useStreamTracks } from '@/hooks/useStreamTracks';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEnrichStream, useReorderStreams, useBulkMoveCategory } from '@/hooks/useMetadata';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { EpisodeManagerModal } from './EpisodeManagerModal';
import { useStreams, useStartStream, useStopStream, useRestartStream, useDeleteStream, useCreateStream, useUpdateStream, useUpdateStreamBackupUrls } from '@/hooks/useStreams';
import { useCategories } from '@/hooks/useCategories';
import { useServers } from '@/hooks/useServers';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { Stream } from '@/types';
import { cn, copyToClipboard } from '@/lib/utils';
import { useStreamNowPlaying } from '@/hooks/useEPG';

type StreamType = 'LIVE' | 'VOD' | 'SERIES';

const TYPE_TITLES: Record<StreamType, string> = {
  LIVE: 'streams.typeLive',
  VOD: 'streams.typeVod',
  SERIES: 'streams.typeSeries',
};

const WORKER_CFG = {
  RUNNING: { dot: 'bg-emerald-400 animate-pulse', label: 'streams.workerRunning', text: 'text-emerald-400' },
  CRASHED: { dot: 'bg-red-500',                   label: 'streams.workerCrashed', text: 'text-red-400' },
  STOPPED: { dot: 'bg-amber-400',                 label: 'streams.workerStopped', text: 'text-amber-400' },
  IDLE:    { dot: 'bg-gray-500',                  label: 'streams.workerIdle',    text: 'text-gray-400' },
} as const;

const HEALTH_DOT: Record<string, string> = {
  HEALTHY:   'bg-emerald-400 animate-pulse',
  UNHEALTHY: 'bg-yellow-400',
  UNKNOWN:   'bg-gray-500',
};

function formatUptime(since: string): string {
  const s = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

function UptimeBadge({ since }: { since: string }) {
  const [label, setLabel] = useState(() => formatUptime(since));
  useEffect(() => {
    const t = setInterval(() => setLabel(formatUptime(since)), 1000);
    return () => clearInterval(t);
  }, [since]);
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium">
      {label}
    </span>
  );
}

function ActionBtn({
  icon: Icon,
  title,
  color,
  onClick,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={cn('p-1.5 rounded-md hover:bg-surface-2 transition-colors disabled:opacity-50', color)}
    >
      <Icon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
    </button>
  );
}

interface PreviewInfo {
  token: string;
  previewProxyUrl: string;
  hlsUrl: string;
  name: string;
  streamMode: string;
  externalId: number;
}

function UptimeHealthBadge({ uptimePercent }: { uptimePercent?: number | null }) {
  if (uptimePercent == null) return <span className="text-xs text-muted">—</span>;
  const pct = uptimePercent;
  const color = pct >= 95 ? 'bg-emerald-500/20 text-emerald-400' : pct >= 80 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
  return (
    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded', color)}>
      %{pct.toFixed(1)}
    </span>
  );
}

interface CreateForm {
  name: string;
  categoryId: string;
  primaryUrl: string;
  backupUrl: string;
  serverId: string;
  tvgLogo: string;
  streamMode: 'PROXY' | 'TRANSCODE' | 'LOOP';
  loopSources: string[];
  loopShuffle: boolean;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  releaseYear: string;
  tmdbRating: string;
  tmdbGenres: string;
}

const EMPTY_FORM: CreateForm = {
  name: '', categoryId: '', primaryUrl: '', backupUrl: '', serverId: '', tvgLogo: '', streamMode: 'PROXY',
  loopSources: [], loopShuffle: false,
  overview: '', posterUrl: '', backdropUrl: '', releaseYear: '', tmdbRating: '', tmdbGenres: '',
};

interface MetaForm {
  name: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  releaseYear: string;
  tmdbRating: string;
  tmdbGenres: string;
}

const EMPTY_META: MetaForm = {
  name: '', overview: '', posterUrl: '', backdropUrl: '', releaseYear: '', tmdbRating: '', tmdbGenres: '',
};

function getUrlPage(): number {
  return Math.max(1, parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10));
}

type HlsCtor = {
  isSupported(): boolean;
  new(): { loadSource(s: string): void; attachMedia(v: HTMLVideoElement): void; on(e: string, cb: () => void): void; destroy(): void };
  Events: { MANIFEST_PARSED: string };
};

function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const init = (Hls: HlsCtor) => {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { void video.play(); });
        return () => hls.destroy();
      }
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        void video.play();
      }
      return undefined;
    };

    const win = window as unknown as Record<string, unknown>;
    if (win.Hls) {
      return init(win.Hls as HlsCtor);
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    let cleanupFn: (() => void) | undefined;
    script.onload = () => { cleanupFn = init(win.Hls as HlsCtor); };
    document.head.appendChild(script);
    return () => { cleanupFn?.(); };
  }, [src]);

  return (
    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full rounded-lg bg-black"
        controls
        muted
      />
    </div>
  );
}

function StreamTracksModal({ streamId, streamName, onClose }: { streamId: string; streamName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useStreamTracks(streamId);
  const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return (
    <Modal open onClose={onClose} title={t('streams.tracksTitle', { name: streamName })} size="lg">
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted">{t('streams.tracksProbing')}</div>
        ) : isError ? (
          <div className="py-8 text-center text-sm text-danger">{errMsg || t('streams.tracksError')}</div>
        ) : (
          <>
            {data?.video && (
              <div className="text-sm">
                <div className="text-xs text-muted uppercase tracking-wider mb-1">{t('streams.trackVideo')}</div>
                <div className="flex items-center gap-3 text-slate-200">
                  <span className="badge bg-primary/10 text-primary uppercase">{data.video.codec ?? '—'}</span>
                  <span>{data.video.resolution ?? '—'}</span>
                  {data.video.fps ? <span className="text-muted">{data.video.fps} fps</span> : null}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-1.5">{t('streams.trackAudio')} ({data?.audio.length ?? 0})</div>
              {(data?.audio.length ?? 0) === 0 ? (
                <div className="text-sm text-muted">{t('streams.trackNone')}</div>
              ) : (
                <div className="space-y-1.5">
                  {data!.audio.map((a) => (
                    <div key={`a${a.index}`} className="flex items-center gap-3 text-sm bg-surface-2 rounded px-3 py-1.5">
                      <span className="text-xs text-muted w-8">#{a.index}</span>
                      <span className="badge bg-primary/10 text-primary uppercase">{a.language || '—'}</span>
                      <span className="text-slate-200">{a.codec ?? '—'}</span>
                      {a.channels ? <span className="text-muted text-xs">{a.channels}ch</span> : null}
                      {a.title ? <span className="text-muted text-xs truncate">· {a.title}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted uppercase tracking-wider mb-1.5">{t('streams.trackSubtitle')} ({data?.subtitle.length ?? 0})</div>
              {(data?.subtitle.length ?? 0) === 0 ? (
                <div className="text-sm text-muted">{t('streams.trackNone')}</div>
              ) : (
                <div className="space-y-1.5">
                  {data!.subtitle.map((sb) => (
                    <div key={`s${sb.index}`} className="flex items-center gap-3 text-sm bg-surface-2 rounded px-3 py-1.5">
                      <span className="text-xs text-muted w-8">#{sb.index}</span>
                      <span className="badge bg-info/10 text-info uppercase">{sb.language || '—'}</span>
                      <span className="text-slate-200">{sb.codec ?? '—'}</span>
                      {sb.title ? <span className="text-muted text-xs truncate">· {sb.title}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted">{t('streams.tracksHint')}</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function StreamHealthModal({ streamId, streamName, onClose }: { streamId: string; streamName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [hours, setHours] = useState(24);
  const { data, isLoading } = useStreamHealth(streamId, hours);
  const manualCheck = useManualHealthCheck();

  const STATUS_CFG = {
    up: { icon: CheckCircle2, color: 'text-emerald-400', label: t('streams.statusUp') },
    down: { icon: XCircle, color: 'text-red-400', label: t('streams.offline') },
    degraded: { icon: AlertTriangle, color: 'text-yellow-400', label: t('streams.statusDegraded') },
  } as const;

  return (
    <Modal open onClose={onClose} title={t('streams.healthTitle', { name: streamName })} size="xl">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[6, 24, 48, 168].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={cn('text-xs px-2.5 py-1 rounded-md transition-colors', hours === h ? 'bg-primary text-white' : 'btn-ghost')}
              >
                {h < 24 ? `${h}s` : h === 24 ? '24s' : h === 48 ? '2g' : '7g'}
              </button>
            ))}
          </div>
          <button
            onClick={() => manualCheck.mutate(streamId)}
            disabled={manualCheck.isPending}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', manualCheck.isPending && 'animate-spin')} />
            {t('streams.checkNow')}
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted text-sm">{t('common.loading')}</div>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: ShieldCheck, label: t('streams.uptime'), value: `%${data.uptimePercent.toFixed(1)}`, color: data.uptimePercent >= 95 ? 'text-emerald-400' : data.uptimePercent >= 80 ? 'text-yellow-400' : 'text-red-400' },
                { icon: Clock, label: t('streams.avgResponse'), value: data.avgResponseTime != null ? `${data.avgResponseTime} ms` : '—', color: 'text-blue-400' },
                { icon: Activity, label: t('streams.totalChecks'), value: String(data.totalChecks), color: 'text-fg' },
                { icon: XCircle, label: t('streams.offline'), value: String(data.downCount), color: data.downCount > 0 ? 'text-red-400' : 'text-muted' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-surface-2 rounded-xl p-3 flex items-start gap-2.5">
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', color)} />
                  <div>
                    <p className="text-xs text-muted">{label}</p>
                    <p className={cn('text-sm font-bold', color)}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart */}
            {data.chartData.length > 0 && (
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-xs text-muted mb-2">{t('streams.chartTitle', { hours })}</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={data.chartData} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      tickFormatter={(v: string) => new Date(v).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      interval="preserveStartEnd"
                    />
                    <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} width={28} unit="%" />
                    <YAxis yAxisId="rt" orientation="right" tick={{ fontSize: 9, fill: '#94a3b8' }} width={32} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1c1f2e', border: '1px solid #2e3347', borderRadius: 8, fontSize: 11 }}
                      labelFormatter={(v: string) => new Date(v).toLocaleString('tr-TR')}
                      formatter={(value: number, name: string) => [name === 'uptime' ? `%${value}` : `${value} ms`, name === 'uptime' ? t('streams.uptime') : t('streams.response')]}
                    />
                    <Line yAxisId="pct" type="monotone" dataKey="uptime" stroke="#34d399" strokeWidth={1.5} dot={false} connectNulls />
                    <Line yAxisId="rt" type="monotone" dataKey="responseTime" stroke="#60a5fa" strokeWidth={1.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Log table */}
            {data.recentLogs.length > 0 && (
              <div className="bg-surface-2 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-2 text-muted font-medium">{t('streams.time')}</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">{t('common.status')}</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">{t('streams.response')}</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">{t('streams.error')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLogs.map((log) => {
                      const cfg = STATUS_CFG[log.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.down;
                      const Icon = cfg.icon;
                      return (
                        <tr key={log.id} className="border-b border-border/50 last:border-0 hover:bg-surface transition-colors">
                          <td className="px-3 py-2 font-mono text-muted whitespace-nowrap">
                            {new Date(log.checkedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn('flex items-center gap-1', cfg.color)}>
                              <Icon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-fg">
                            {log.responseTime != null ? `${log.responseTime} ms` : '—'}
                          </td>
                          <td className="px-3 py-2 text-muted truncate max-w-32" title={log.errorMessage ?? ''}>
                            {log.errorMessage ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted text-sm">{t('common.noData')}</div>
        )}
      </div>
    </Modal>
  );
}

function SortHandle({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('inline-flex cursor-grab text-muted hover:text-slate-300', isDragging && 'opacity-50 cursor-grabbing')}
    >
      <GripVertical className="w-3.5 h-3.5" />
    </span>
  );
}

export function StreamsPage({ type }: { type?: StreamType }) {
  const { t } = useTranslation();
  const [page, setPageState] = useState(getUrlPage);

  const setPage = useCallback((p: number) => {
    setPageState(p);
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(p));
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, []);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [serverId, setServerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [resolution, setResolution] = useState('');
  const [qualityScore, setQualityScore] = useState('');
  const [healthStatus, setHealthStatus] = useState('');
  const [videoCodec, setVideoCodec] = useState('');
  const [updatedAfter, setUpdatedAfter] = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [healthStream, setHealthStream] = useState<{ id: string; name: string } | null>(null);
  const [tracksStream, setTracksStream] = useState<{ id: string; name: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [editStream, setEditStream] = useState<Stream | null>(null);
  const [editBackupUrls, setEditBackupUrls] = useState<string[]>([]);
  const [metaStream, setMetaStream] = useState<Stream | null>(null);
  const [metaForm, setMetaForm] = useState<MetaForm>(EMPTY_META);
  const [episodeSeries, setEpisodeSeries] = useState<Stream | null>(null);
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkMoveCatId, setBulkMoveCatId] = useState('');
  const [sortedItems, setSortedItems] = useState<Stream[]>([]);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enrichStream = useEnrichStream();
  const reorderStreams = useReorderStreams();
  const bulkMoveCategory = useBulkMoveCategory();
  const updateBackupUrls = useUpdateStreamBackupUrls();
  const updateStream = useUpdateStream();

  // Meta modal açılınca formu stream'in mevcut değerleriyle doldur.
  useEffect(() => {
    if (!metaStream) { setMetaForm(EMPTY_META); return; }
    setMetaForm({
      name: metaStream.name ?? '',
      overview: metaStream.overview ?? '',
      posterUrl: metaStream.posterUrl ?? '',
      backdropUrl: metaStream.backdropUrl ?? '',
      releaseYear: metaStream.releaseYear != null ? String(metaStream.releaseYear) : '',
      tmdbRating: metaStream.tmdbRating != null ? String(metaStream.tmdbRating) : '',
      tmdbGenres: (metaStream.tmdbGenres ?? []).join(', '),
    });
  }, [metaStream]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hasAdvFilters = !!(resolution || qualityScore || healthStatus || videoCodec || updatedAfter);
  const clearAdvFilters = () => { setResolution(''); setQualityScore(''); setHealthStatus(''); setVideoCodec(''); setUpdatedAfter(''); setPage(1); };

  const { data, isLoading, refetch } = useStreams({
    page, limit: 25, search, status, serverId, categoryId, type,
    resolution, qualityScore, healthStatus, videoCodec,
    updatedAfter: updatedAfter ? new Date(updatedAfter).toISOString() : undefined,
    refetchInterval: autoRefresh ? 5000 : false,
  });
  const { data: categories } = useCategories(type);
  const { data: servers } = useServers();
  const startStream = useStartStream();
  const stopStream = useStopStream();
  const restart = useRestartStream();
  const deleteStream = useDeleteStream();
  const createStream = useCreateStream();

  const showEpgColumn = !type || type === 'LIVE';
  const visibleItems = sortedItems.length > 0 ? sortedItems : (data?.items ?? []);
  const { data: nowPlaying } = useStreamNowPlaying(
    showEpgColumn ? visibleItems.map((s) => s.id) : [],
  );

  const handleRefresh = useCallback(() => void refetch(), [refetch]);
  const pageTitle = type ? t(TYPE_TITLES[type]) : t('streams.pageTitleAll');

  // Sync sorted items when data changes
  useEffect(() => {
    if (data?.items) setSortedItems(data.items);
  }, [data?.items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSortedItems((items) => {
      const oldIdx = items.findIndex((i) => i.id === active.id);
      const newIdx = items.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(items, oldIdx, newIdx);
      if (reorderDebounce.current) clearTimeout(reorderDebounce.current);
      reorderDebounce.current = setTimeout(() => {
        reorderStreams.mutate(reordered.map((i) => i.id));
      }, 500);
      return reordered;
    });
  };

  const columns: Column<Stream>[] = [
    {
      key: 'externalId',
      header: '#',
      className: 'w-12',
      render: (r) => <span className="text-xs font-mono text-muted">#{r.externalId}</span>,
    },
    {
      key: 'tvgLogo',
      header: t('streams.icon'),
      className: 'w-14',
      render: (r) => {
        const poster = (r as Stream & { posterUrl?: string }).posterUrl;
        const imgSrc = poster ?? r.tvgLogo;
        const hasBackdrop = !!(r as Stream & { backdropUrl?: string }).backdropUrl;
        const overview = (r as Stream & { overview?: string }).overview;
        return (
          <div className="relative group">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                className="w-8 h-10 rounded-md object-cover border border-border bg-surface-2"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="w-8 h-10 rounded-md bg-surface-2 border border-border flex items-center justify-center">
                <Tv className="w-4 h-4 text-muted" />
              </div>
            )}
            {/* Backdrop + overview tooltip on hover */}
            {(hasBackdrop || overview) && (
              <div className="absolute left-10 top-0 z-20 w-56 hidden group-hover:block pointer-events-none">
                <div className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden text-xs">
                  {hasBackdrop && (
                    <img
                      src={(r as Stream & { backdropUrl?: string }).backdropUrl!}
                      alt=""
                      className="w-full h-28 object-cover"
                    />
                  )}
                  {overview && <div className="p-2 text-muted line-clamp-3">{overview}</div>}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'workerStatus',
      header: t('common.status'),
      className: 'w-28',
      render: (r) => {
        const cfg = WORKER_CFG[r.workerStatus] ?? WORKER_CFG.IDLE;
        const healthDot = r.workerStatus === 'RUNNING' && r.healthStatus
          ? HEALTH_DOT[r.healthStatus] ?? HEALTH_DOT.UNKNOWN
          : null;
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', healthDot ?? cfg.dot)} />
              <span className={cn('text-xs font-medium', cfg.text)}>{t(cfg.label)}</span>
            </div>
            {r.workerStatus === 'RUNNING' && r.healthStatus && r.healthStatus !== 'HEALTHY' && (
              <span className="text-xs text-yellow-400 ml-4">
                {r.healthStatus === 'UNHEALTHY' ? t('streams.unhealthy') : t('streams.unknown')}
                {r.uptimePercent != null && ` · %${r.uptimePercent}`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'name',
      header: t('streams.name'),
      render: (r) => {
        const sr = r as Stream & { todayViews?: number; totalViews?: number; lastViewedAt?: string | null };
        const hasStats = (sr.todayViews ?? 0) > 0 || (sr.totalViews ?? 0) > 0;
        return (
          <div className="relative group">
            <div>
              <div className="text-sm font-medium text-slate-100">{r.name}</div>
              {r.category && <div className="text-xs text-muted mt-0.5">{r.category.name}</div>}
            </div>
            {hasStats && (
              <div className="absolute left-0 top-full mt-1 z-30 w-52 hidden group-hover:block pointer-events-none">
                <div className="bg-surface border border-border rounded-xl shadow-2xl p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{t('streams.today')}</span>
                    <span className="font-semibold text-slate-200">{t('streams.viewsN', { n: sr.todayViews ?? 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{t('common.total')}</span>
                    <span className="font-semibold text-slate-200">{t('streams.viewsN', { n: sr.totalViews ?? 0 })}</span>
                  </div>
                  {sr.lastViewedAt && (
                    <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1.5">
                      <span className="text-muted">{t('streams.lastView')}</span>
                      <span className="text-slate-400">{new Date(sr.lastViewedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'primaryUrl',
      header: t('streams.source'),
      render: (r) => (
        <span className="text-xs font-mono text-muted" title={r.primaryUrl}>
          {r.primaryUrl.length > 40 ? r.primaryUrl.substring(0, 40) + '…' : r.primaryUrl}
        </span>
      ),
    },
    {
      key: 'server',
      header: t('streams.server'),
      className: 'w-28',
      render: (r) => <span className="text-xs text-slate-300">{r.server?.name ?? '—'}</span>,
    },
    {
      key: 'connections',
      header: t('streams.viewers'),
      className: 'text-center w-20',
      headerClassName: 'text-center',
      render: (r) => (
        <span className="text-sm font-semibold text-slate-100">
          {r._count?.connections ?? 0}
        </span>
      ),
    },
    {
      key: 'uptime',
      header: t('streams.uptime'),
      className: 'w-36',
      render: (r) =>
        r.workerStatus === 'RUNNING' ? (
          <UptimeBadge since={r.updatedAt} />
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: 'healthUptime',
      header: t('streams.healthStatus'),
      className: 'w-20',
      render: (r) => {
        const up = (r as Stream & { uptimePercent?: number | null }).uptimePercent;
        return <UptimeHealthBadge uptimePercent={up} />;
      },
    },
    {
      key: 'resolution',
      header: t('streams.resolutionQuality'),
      className: 'w-36',
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">{r.resolution ?? '—'}</span>
            {r.videoCodec && (
              <span className="text-[10px] uppercase font-medium text-muted bg-surface-2 px-1 py-0.5 rounded leading-none">{r.videoCodec}</span>
            )}
            {r.qualityScore && (
              <span className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded',
                r.qualityScore === 'A' && 'bg-green-500/20 text-green-400',
                r.qualityScore === 'B' && 'bg-lime-500/20 text-lime-400',
                r.qualityScore === 'C' && 'bg-yellow-500/20 text-yellow-400',
                r.qualityScore === 'D' && 'bg-orange-500/20 text-orange-400',
                r.qualityScore === 'F' && 'bg-red-500/20 text-red-400',
              )}>
                {r.qualityScore}
              </span>
            )}
          </div>
        </div>
      ),
    },
    ...(showEpgColumn ? [{
      key: 'epg',
      header: t('streams.nowPlaying'),
      className: 'w-44 hidden xl:table-cell',
      render: (r: Stream) => {
        const np = nowPlaying?.[r.id];
        if (!np?.current) return <span className="text-xs text-muted">—</span>;
        const start = new Date(np.current.start).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const stop = new Date(np.current.stop).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return (
          <div title={`${start} → ${stop}`} className="text-xs text-slate-300 truncate max-w-[160px] cursor-default">
            {np.current.title}
          </div>
        );
      },
    } as Column<Stream>] : []),
    {
      key: 'actions',
      header: t('common.actions'),
      className: 'w-36',
      render: (r) => (
        <div className="flex items-center gap-0.5">
          {r.workerStatus !== 'RUNNING' && (
            <ActionBtn
              icon={Play} title={t('streams.start')} color="text-green-400"
              onClick={() => startStream.mutate(r.id)}
              loading={startStream.isPending && startStream.variables === r.id}
            />
          )}
          {r.workerStatus === 'RUNNING' && (
            <ActionBtn
              icon={Square} title={t('streams.stop')} color="text-amber-400"
              onClick={() => stopStream.mutate(r.id)}
              loading={stopStream.isPending && stopStream.variables === r.id}
            />
          )}
          <ActionBtn
            icon={RotateCcw} title={t('streams.restart')} color="text-emerald-400"
            onClick={() => restart.mutate(r.id)}
            loading={restart.isPending && restart.variables === r.id}
          />
          <ActionBtn icon={Pencil} title={t('common.edit')} color="text-blue-400" onClick={() => { setEditStream(r); setEditBackupUrls(r.backupUrls ?? []); }} />
          <ActionBtn icon={Activity} title={t('streams.healthReport')} color="text-emerald-400" onClick={() => setHealthStream({ id: r.id, name: r.name })} />
          <ActionBtn icon={AudioLines} title={t('streams.tracks')} color="text-primary-light" onClick={() => setTracksStream({ id: r.id, name: r.name })} />
          <ActionBtn icon={Trash2} title={t('common.delete')} color="text-red-400" onClick={() => setDeleteId(r.id)} />
          <ActionBtn icon={Eye} title={t('streams.showUrl')} color="text-muted" onClick={() => setPreviewInfo({ token: '', previewProxyUrl: '', hlsUrl: r.primaryUrl, name: r.name, streamMode: r.streamMode, externalId: r.externalId })} />
          {(!type || type === 'LIVE') && (
            <ActionBtn
              icon={Clapperboard}
              title={t('streams.preview')}
              color="text-cyan-400"
              loading={previewLoading === r.id}
              onClick={() => {
                setPreviewLoading(r.id);
                api.get<{ success: boolean; data: PreviewInfo }>(`/streams/${r.id}/preview-url`)
                  .then((res) => { setPreviewInfo(res.data.data); })
                  .catch(() => toast.error(t('streams.previewFailed')))
                  .finally(() => setPreviewLoading(null));
              }}
            />
          )}
          <ActionBtn
            icon={Microscope}
            title={t('streams.analyzeQuality')}
            color="text-purple-400"
            onClick={() => {
              api.post(`/streams/${r.id}/analyze`)
                .then(() => toast.success(t('streams.analyzeStarted', { name: r.name })))
                .catch(() => toast.error(t('streams.analyzeFailed')));
            }}
          />
          <ActionBtn
            icon={Copy}
            title={t('streams.clone')}
            color="text-sky-400"
            onClick={() => {
              api.post<{ success: boolean; data: { name: string } }>(`/streams/${r.id}/clone`)
                .then((res) => toast.success(t('streams.cloned', { name: res.data.data.name })))
                .catch(() => toast.error(t('streams.cloneFailed')));
            }}
          />
          {(type === 'VOD' || type === 'SERIES') && (
            <ActionBtn
              icon={Sparkles}
              title={t('streams.fetchMeta')}
              color="text-yellow-400"
              loading={enrichStream.isPending && (enrichStream.variables as { id: string } | undefined)?.id === r.id}
              onClick={() => enrichStream.mutate({ id: r.id, type })}
            />
          )}
          {(type === 'VOD' || type === 'SERIES') && (
            <ActionBtn icon={Film} title={t('streams.editMeta')} color="text-purple-400" onClick={() => setMetaStream(r)} />
          )}
          {type === 'SERIES' && (
            <ActionBtn icon={ListVideo} title={t('streams.episodes')} color="text-cyan-400" onClick={() => setEpisodeSeries(r)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={t('streams.recordCount', { count: data?.total ?? 0 })}
        actions={
          <>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                'btn-ghost flex items-center gap-1.5 text-xs',
                autoRefresh ? 'text-emerald-400' : '',
              )}
              title={autoRefresh ? t('streams.autoRefreshOn') : t('streams.autoRefreshOff')}
            >
              {autoRefresh ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span className="hidden sm:inline">{t('streams.autoRefresh')}</span>
            </button>
            <button onClick={handleRefresh} className="btn-ghost" title={t('streams.refresh')}>
              <RefreshCw className="w-4 h-4" />
            </button>
            {selectedStreamIds.size > 0 && (
              <button
                onClick={() => setShowBulkMove(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <FolderInput className="w-4 h-4" />
                {t('streams.moveSelected', { n: selectedStreamIds.size })}
              </button>
            )}
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('streams.addChannel')}</span>
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-3 mb-4 space-y-2.5">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              className="input pl-9 h-9"
              placeholder={t('streams.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input h-9 w-auto min-w-36" value={serverId} onChange={(e) => { setServerId(e.target.value); setPage(1); }}>
            <option value="">{t('streams.allServers')}</option>
            {servers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input h-9 w-auto min-w-36" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">{t('streams.allCategories')}</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input h-9 w-auto min-w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">{t('streams.allStatuses')}</option>
            <option value="RUNNING">{t('streams.workerRunning')}</option>
            <option value="IDLE">{t('streams.workerIdle')}</option>
            <option value="CRASHED">{t('streams.workerCrashed')}</option>
            <option value="STOPPED">{t('streams.workerStopped')}</option>
          </select>
          <button
            onClick={() => setShowAdvFilters((v) => !v)}
            className={cn('btn btn-ghost h-9 text-sm gap-1.5', (showAdvFilters || hasAdvFilters) && 'text-primary')}
          >
            <Filter className="w-3.5 h-3.5" />
            {t('streams.advanced')}
            {hasAdvFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {hasAdvFilters && (
            <button onClick={clearAdvFilters} className="btn btn-ghost h-9 text-xs text-muted hover:text-danger">
              {t('streams.clear')}
            </button>
          )}
        </div>

        {showAdvFilters && (
          <div className="flex flex-wrap gap-2.5 items-center border-t border-border pt-2.5">
            <select className="input h-9 w-auto min-w-32" value={resolution} onChange={(e) => { setResolution(e.target.value); setPage(1); }}>
              <option value="">{t('streams.allResolutions')}</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
            <select className="input h-9 w-auto min-w-32" value={qualityScore} onChange={(e) => { setQualityScore(e.target.value); setPage(1); }}>
              <option value="">{t('streams.allQualities')}</option>
              <option value="A">{t('streams.qualityA')}</option>
              <option value="B">{t('streams.qualityB')}</option>
              <option value="C">{t('streams.qualityC')}</option>
              <option value="D">{t('streams.qualityD')}</option>
              <option value="F">{t('streams.qualityF')}</option>
            </select>
            <select className="input h-9 w-auto min-w-36" value={healthStatus} onChange={(e) => { setHealthStatus(e.target.value); setPage(1); }}>
              <option value="">{t('streams.allHealth')}</option>
              <option value="HEALTHY">{t('streams.healthy')}</option>
              <option value="UNHEALTHY">{t('streams.unhealthy')}</option>
              <option value="UNKNOWN">{t('streams.unknown')}</option>
            </select>
            <select className="input h-9 w-auto min-w-28" value={videoCodec} onChange={(e) => { setVideoCodec(e.target.value); setPage(1); }}>
              <option value="">{t('streams.allCodec')}</option>
              <option value="h264">H.264</option>
              <option value="h265">H.265 / HEVC</option>
              <option value="av1">AV1</option>
              <option value="vp9">VP9</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted whitespace-nowrap">{t('streams.updatedAfterLabel')}</label>
              <select className="input h-9 w-auto" value={updatedAfter} onChange={(e) => { setUpdatedAfter(e.target.value); setPage(1); }}>
                <option value="">{t('streams.anytime')}</option>
                <option value={new Date(Date.now() - 86400000).toISOString()}>{t('streams.today')}</option>
                <option value={new Date(Date.now() - 7 * 86400000).toISOString()}>{t('streams.thisWeek')}</option>
                <option value={new Date(Date.now() - 30 * 86400000).toISOString()}>{t('streams.thisMonth')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table with drag-drop */}
      <div className="card overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <DataTable
              columns={[
                {
                  key: '_drag',
                  header: '',
                  className: 'w-8',
                  render: (r) => <SortHandle id={r.id} />,
                },
                ...columns,
              ]}
              data={sortedItems.length > 0 ? sortedItems : (data?.items ?? [])}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
              page={page}
              totalPages={data?.totalPages}
              total={data?.total}
              onPageChange={setPage}
              emptyTitle={t('streams.emptyTitle')}
              emptyDescription={t('streams.emptyDescription')}
              mobileCards
            />
          </SortableContext>
        </DndContext>
      </div>

      {/* Bulk move modal */}
      <Modal open={showBulkMove} onClose={() => setShowBulkMove(false)} title={t('streams.moveStreamsTitle', { n: selectedStreamIds.size })} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('streams.selectTargetCategory')}</p>
          <select
            className="input w-full"
            value={bulkMoveCatId}
            onChange={(e) => setBulkMoveCatId(e.target.value)}
          >
            <option value="">{t('streams.selectCategoryOption')}</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setShowBulkMove(false)}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary"
              disabled={!bulkMoveCatId || bulkMoveCategory.isPending}
              onClick={async () => {
                await bulkMoveCategory.mutateAsync({ streamIds: [...selectedStreamIds], categoryId: bulkMoveCatId });
                setShowBulkMove(false);
                setSelectedStreamIds(new Set());
              }}
            >
              {t('streams.move')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!previewInfo}
        onClose={() => setPreviewInfo(null)}
        title={previewInfo?.name ?? t('streams.preview')}
        size="lg"
      >
        {previewInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                previewInfo.streamMode === 'PROXY'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-violet-500/20 text-violet-400',
              )}>
                {previewInfo.streamMode || 'DIRECT'}
              </span>
              {previewInfo.externalId ? (
                <span className="text-xs text-muted font-mono">#{previewInfo.externalId}</span>
              ) : null}
            </div>

            {/* HLS video player — mounts only when proxy URL is available */}
            {previewInfo.previewProxyUrl && (
              <HlsPlayer src={window.location.origin + previewInfo.previewProxyUrl} />
            )}

            {/* Upstream URL — info only */}
            <div>
              <p className="text-xs text-muted mb-1">{t('streams.sourceUrl')}</p>
              <p className="rounded-lg px-3 py-2.5 font-mono text-xs break-all bg-surface-2 text-fg border border-border">
                {previewInfo.hlsUrl}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { void copyToClipboard(previewInfo.hlsUrl); toast.success(t('streams.copied')); }}
                className="btn-ghost text-xs text-blue-400 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                {t('streams.copyUrl')}
              </button>
              <button onClick={() => setPreviewInfo(null)} className="btn-ghost text-xs flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}
        title={t('streams.addTitle', { kind: type === 'VOD' ? t('streams.kindMovie') : type === 'SERIES' ? t('streams.kindSeries') : t('streams.kindChannel') })}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('streams.channelNameLabel')} *</label>
            <input
              className="input"
              placeholder={t('streams.channelNamePlaceholder')}
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.categoryLabel')} *</label>
            <select
              className="input"
              value={createForm.categoryId}
              onChange={(e) => setCreateForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">{t('streams.selectCategory')}</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('streams.sourceUrl')} *</label>
            <input
              className="input font-mono text-xs"
              placeholder={t('streams.urlPlaceholder')}
              value={createForm.primaryUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, primaryUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.backupUrl')}</label>
            <input
              className="input font-mono text-xs"
              placeholder={t('streams.backupUrlPlaceholder')}
              value={createForm.backupUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, backupUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.server')}</label>
            <select
              className="input"
              value={createForm.serverId}
              onChange={(e) => setCreateForm((f) => ({ ...f, serverId: e.target.value }))}
            >
              <option value="">{t('streams.selectServer')}</option>
              {servers?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.ip}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('streams.logoUrl')}</label>
            <input
              className="input"
              placeholder={t('streams.logoUrlPlaceholder')}
              value={createForm.tvgLogo}
              onChange={(e) => setCreateForm((f) => ({ ...f, tvgLogo: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.streamMode')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['PROXY', 'TRANSCODE', 'LOOP'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCreateForm((f) => ({ ...f, streamMode: mode }))}
                  className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                    createForm.streamMode === mode
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-border bg-surface-2 text-muted hover:border-indigo-500/40'
                  }`}
                >
                  <span className="font-semibold">
                    {mode === 'PROXY' ? t('streams.modeProxy') : mode === 'TRANSCODE' ? t('streams.modeTranscode') : t('streams.modeLoop')}
                    {mode === 'PROXY' && <span className="ml-1.5 text-emerald-400 text-[10px]">{t('streams.recommended')}</span>}
                  </span>
                  <span className="text-[10px] leading-snug opacity-70">
                    {mode === 'PROXY'
                      ? t('streams.modeProxyDesc')
                      : mode === 'TRANSCODE'
                      ? t('streams.modeTranscodeDesc')
                      : t('streams.modeLoopDesc')}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {createForm.streamMode === 'LOOP' && (
            <div className="space-y-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3">
              <p className="text-[11px] text-muted leading-snug">{t('streams.loopHint')}</p>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={createForm.loopShuffle}
                  onChange={(e) => setCreateForm((f) => ({ ...f, loopShuffle: e.target.checked }))}
                />
                {t('streams.loopShuffle')}
              </label>
              <div>
                <label className="label">{t('streams.loopExtraSources')}</label>
                <div className="space-y-2">
                  {createForm.loopSources.map((src, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input font-mono text-xs"
                        placeholder={t('streams.urlPlaceholder')}
                        value={src}
                        onChange={(e) => setCreateForm((f) => {
                          const next = [...f.loopSources];
                          next[i] = e.target.value;
                          return { ...f, loopSources: next };
                        })}
                      />
                      <button
                        type="button"
                        className="btn-ghost px-2 shrink-0"
                        onClick={() => setCreateForm((f) => ({ ...f, loopSources: f.loopSources.filter((_, idx) => idx !== i) }))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => setCreateForm((f) => ({ ...f, loopSources: [...f.loopSources, ''] }))}
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('streams.loopAddSource')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {(type === 'VOD' || type === 'SERIES') && (
            <div className="space-y-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">{t('streams.metadataOptional')}</p>
              <div>
                <label className="label">{t('streams.overview')}</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder={t('streams.overviewPlaceholder')}
                  value={createForm.overview}
                  onChange={(e) => setCreateForm((f) => ({ ...f, overview: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{t('streams.posterUrl')}</label>
                <input
                  className="input"
                  placeholder={t('streams.urlPlaceholderShort')}
                  value={createForm.posterUrl}
                  onChange={(e) => setCreateForm((f) => ({ ...f, posterUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">{t('streams.backdropUrl')}</label>
                <input
                  className="input"
                  placeholder={t('streams.urlPlaceholderShort')}
                  value={createForm.backdropUrl}
                  onChange={(e) => setCreateForm((f) => ({ ...f, backdropUrl: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">{t('streams.year')}</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="2024"
                    value={createForm.releaseYear}
                    onChange={(e) => setCreateForm((f) => ({ ...f, releaseYear: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">{t('streams.rating')}</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    placeholder="7.5"
                    value={createForm.tmdbRating}
                    onChange={(e) => setCreateForm((f) => ({ ...f, tmdbRating: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('streams.genres')}</label>
                <input
                  className="input"
                  placeholder={t('streams.genresPlaceholder')}
                  value={createForm.tmdbGenres}
                  onChange={(e) => setCreateForm((f) => ({ ...f, tmdbGenres: e.target.value }))}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button
              onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}
              className="btn-ghost"
            >
              {t('common.cancel')}
            </button>
            <button
              disabled={
                createStream.isPending ||
                !createForm.name ||
                !createForm.primaryUrl ||
                !createForm.categoryId
              }
              onClick={() => {
                // NOT: 'type' gönderilmez — backend stream tipini Category.type'tan
                // türetir; CreateStreamDto'da type alanı yok ve ValidationPipe
                // forbidNonWhitelisted ile fazladan alan 400 verirdi.
                const payload = {
                  name: createForm.name,
                  primaryUrl: createForm.primaryUrl,
                  categoryId: createForm.categoryId,
                  streamMode: createForm.streamMode,
                  ...(createForm.streamMode === 'LOOP' && {
                    loopSources: [createForm.primaryUrl, ...createForm.loopSources].map((u) => u.trim()).filter(Boolean),
                    loopShuffle: createForm.loopShuffle,
                  }),
                  ...(createForm.backupUrl && { backupUrl: createForm.backupUrl }),
                  ...(createForm.serverId && { serverId: createForm.serverId }),
                  ...(createForm.tvgLogo && { tvgLogo: createForm.tvgLogo }),
                  ...((type === 'VOD' || type === 'SERIES') ? {
                    overview: createForm.overview || undefined,
                    posterUrl: createForm.posterUrl || undefined,
                    backdropUrl: createForm.backdropUrl || undefined,
                    releaseYear: createForm.releaseYear ? Number(createForm.releaseYear) : undefined,
                    tmdbRating: createForm.tmdbRating ? Number(createForm.tmdbRating) : undefined,
                    tmdbGenres: createForm.tmdbGenres
                      ? createForm.tmdbGenres.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                  } : {}),
                } as Partial<Stream>;
                createStream.mutate(payload, {
                  onSuccess: () => { setShowCreate(false); setCreateForm(EMPTY_FORM); },
                });
              }}
              className="btn-primary"
            >
              {createStream.isPending ? t('streams.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteStream.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        title={t('streams.deleteTitle')}
        message={t('streams.deleteMessage')}
        confirmLabel={t('common.delete')}
        loading={deleteStream.isPending}
      />

      {/* Edit / Backup URLs modal */}
      <Modal
        open={!!editStream}
        onClose={() => setEditStream(null)}
        title={editStream ? t('streams.editTitle', { name: editStream.name }) : ''}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="label">{t('streams.sourceUrlPrimary')}</label>
            <input className="input font-mono text-xs" readOnly value={editStream?.primaryUrl ?? ''} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">{t('streams.backupUrls')}</label>
              {editBackupUrls.length < 3 && (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setEditBackupUrls((prev) => [...prev, ''])}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('common.add')}
                </button>
              )}
            </div>
            {editBackupUrls.length === 0 ? (
              <p className="text-xs text-muted py-2">{t('streams.noBackupUrls')}</p>
            ) : (
              <div className="space-y-2">
                {editBackupUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input font-mono text-xs flex-1"
                      placeholder={t('streams.urlPlaceholder')}
                      value={url}
                      onChange={(e) => {
                        const next = [...editBackupUrls];
                        next[i] = e.target.value;
                        setEditBackupUrls(next);
                      }}
                    />
                    <button
                      type="button"
                      className="p-2 rounded-lg hover:bg-surface-2 text-danger transition-colors"
                      onClick={() => setEditBackupUrls((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted mt-1">{t('streams.backupUrlsHint')}</p>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setEditStream(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={updateBackupUrls.isPending}
              onClick={() => {
                if (!editStream) return;
                const urls = editBackupUrls.filter((u) => u.trim() !== '');
                updateBackupUrls.mutate(
                  { id: editStream.id, backupUrls: urls },
                  { onSuccess: () => setEditStream(null) },
                );
              }}
              className="btn-primary"
            >
              {updateBackupUrls.isPending ? t('streams.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Metadata edit modal (VOD/SERIES) */}
      <Modal
        open={!!metaStream}
        onClose={() => setMetaStream(null)}
        title={metaStream ? t('streams.metaEditTitle', { name: metaStream.name }) : ''}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="label">{t('common.name')}</label>
            <input
              className="input"
              value={metaForm.name}
              onChange={(e) => setMetaForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.overview')}</label>
            <textarea
              className="input"
              rows={3}
              placeholder={t('streams.overviewPlaceholder')}
              value={metaForm.overview}
              onChange={(e) => setMetaForm((f) => ({ ...f, overview: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.posterUrl')}</label>
            <input
              className="input"
              placeholder={t('streams.urlPlaceholderShort')}
              value={metaForm.posterUrl}
              onChange={(e) => setMetaForm((f) => ({ ...f, posterUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t('streams.backdropUrl')}</label>
            <input
              className="input"
              placeholder={t('streams.urlPlaceholderShort')}
              value={metaForm.backdropUrl}
              onChange={(e) => setMetaForm((f) => ({ ...f, backdropUrl: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('streams.year')}</label>
              <input
                type="number"
                className="input"
                placeholder="2024"
                value={metaForm.releaseYear}
                onChange={(e) => setMetaForm((f) => ({ ...f, releaseYear: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t('streams.rating')}</label>
              <input
                type="number"
                step="0.1"
                className="input"
                placeholder="7.5"
                value={metaForm.tmdbRating}
                onChange={(e) => setMetaForm((f) => ({ ...f, tmdbRating: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">{t('streams.genres')}</label>
            <input
              className="input"
              placeholder={t('streams.genresPlaceholder')}
              value={metaForm.tmdbGenres}
              onChange={(e) => setMetaForm((f) => ({ ...f, tmdbGenres: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setMetaStream(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button
              disabled={updateStream.isPending || !metaForm.name}
              onClick={() => {
                if (!metaStream) return;
                updateStream.mutate(
                  {
                    id: metaStream.id,
                    data: {
                      name: metaForm.name,
                      overview: metaForm.overview || undefined,
                      posterUrl: metaForm.posterUrl || undefined,
                      backdropUrl: metaForm.backdropUrl || undefined,
                      releaseYear: metaForm.releaseYear ? Number(metaForm.releaseYear) : undefined,
                      tmdbRating: metaForm.tmdbRating ? Number(metaForm.tmdbRating) : undefined,
                      tmdbGenres: metaForm.tmdbGenres
                        ? metaForm.tmdbGenres.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                    },
                  },
                  { onSuccess: () => setMetaStream(null) },
                );
              }}
              className="btn-primary"
            >
              {updateStream.isPending ? t('streams.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Stream health modal */}
      {healthStream && (
        <StreamHealthModal
          streamId={healthStream.id}
          streamName={healthStream.name}
          onClose={() => setHealthStream(null)}
        />
      )}

      {/* Stream tracks (ses/altyazi) modal */}
      {tracksStream && (
        <StreamTracksModal
          streamId={tracksStream.id}
          streamName={tracksStream.name}
          onClose={() => setTracksStream(null)}
        />
      )}

      {/* Episode manager modal (SERIES) */}
      {episodeSeries && (
        <EpisodeManagerModal series={episodeSeries} onClose={() => setEpisodeSeries(null)} />
      )}
    </div>
  );
}
