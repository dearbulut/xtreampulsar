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
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useStreamHealth, useManualHealthCheck } from '@/hooks/useStreamHealth';
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
import { useStreams, useStartStream, useStopStream, useRestartStream, useDeleteStream, useCreateStream } from '@/hooks/useStreams';
import { useCategories } from '@/hooks/useCategories';
import { useServers } from '@/hooks/useServers';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type { Stream } from '@/types';
import { cn } from '@/lib/utils';
import { useStreamNowPlaying } from '@/hooks/useEPG';

type StreamType = 'LIVE' | 'VOD' | 'SERIES';

const TYPE_TITLES: Record<StreamType, string> = {
  LIVE: 'Canlı Kanallar',
  VOD: 'VOD İçerikleri',
  SERIES: 'Dizi İçerikleri',
};

const WORKER_CFG = {
  RUNNING: { dot: 'bg-emerald-400 animate-pulse', label: 'Çalışıyor', text: 'text-emerald-400' },
  CRASHED: { dot: 'bg-red-500',                   label: 'Hata',       text: 'text-red-400' },
  STOPPED: { dot: 'bg-amber-400',                 label: 'Durdu',      text: 'text-amber-400' },
  IDLE:    { dot: 'bg-gray-500',                  label: 'Bekliyor',   text: 'text-gray-400' },
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
  streamMode: 'PROXY' | 'TRANSCODE';
}

const EMPTY_FORM: CreateForm = {
  name: '', categoryId: '', primaryUrl: '', backupUrl: '', serverId: '', tvgLogo: '', streamMode: 'PROXY',
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

function StreamHealthModal({ streamId, streamName, onClose }: { streamId: string; streamName: string; onClose: () => void }) {
  const [hours, setHours] = useState(24);
  const { data, isLoading } = useStreamHealth(streamId, hours);
  const manualCheck = useManualHealthCheck();

  const STATUS_CFG = {
    up: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Çevrimiçi' },
    down: { icon: XCircle, color: 'text-red-400', label: 'Çevrimdışı' },
    degraded: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Yavaş' },
  } as const;

  return (
    <Modal open onClose={onClose} title={`Sağlık: ${streamName}`} size="xl">
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
            Şimdi Kontrol Et
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted text-sm">Yükleniyor…</div>
        ) : data ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: ShieldCheck, label: 'Uptime', value: `%${data.uptimePercent.toFixed(1)}`, color: data.uptimePercent >= 95 ? 'text-emerald-400' : data.uptimePercent >= 80 ? 'text-yellow-400' : 'text-red-400' },
                { icon: Clock, label: 'Ort. Yanıt', value: data.avgResponseTime != null ? `${data.avgResponseTime} ms` : '—', color: 'text-blue-400' },
                { icon: Activity, label: 'Toplam Kontrol', value: String(data.totalChecks), color: 'text-fg' },
                { icon: XCircle, label: 'Çevrimdışı', value: String(data.downCount), color: data.downCount > 0 ? 'text-red-400' : 'text-muted' },
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
                <p className="text-xs text-muted mb-2">Son {hours}s Uptime & Yanıt Süresi</p>
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
                      formatter={(value: number, name: string) => [name === 'uptime' ? `%${value}` : `${value} ms`, name === 'uptime' ? 'Uptime' : 'Yanıt']}
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
                      <th className="text-left px-3 py-2 text-muted font-medium">Zaman</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">Durum</th>
                      <th className="text-right px-3 py-2 text-muted font-medium">Yanıt</th>
                      <th className="text-left px-3 py-2 text-muted font-medium">Hata</th>
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
          <div className="text-center py-8 text-muted text-sm">Veri bulunamadı</div>
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
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkMoveCatId, setBulkMoveCatId] = useState('');
  const [sortedItems, setSortedItems] = useState<Stream[]>([]);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enrichStream = useEnrichStream();
  const reorderStreams = useReorderStreams();
  const bulkMoveCategory = useBulkMoveCategory();

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
  const pageTitle = type ? TYPE_TITLES[type] : "Stream'ler";

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
      header: 'İkon',
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
      header: 'Durum',
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
              <span className={cn('text-xs font-medium', cfg.text)}>{cfg.label}</span>
            </div>
            {r.workerStatus === 'RUNNING' && r.healthStatus && r.healthStatus !== 'HEALTHY' && (
              <span className="text-xs text-yellow-400 ml-4">
                {r.healthStatus === 'UNHEALTHY' ? 'Sorunlu' : 'Bilinmiyor'}
                {r.uptimePercent != null && ` · %${r.uptimePercent}`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'İsim',
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
                    <span className="text-muted">Bugün</span>
                    <span className="font-semibold text-slate-200">{sr.todayViews ?? 0} izlenme</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Toplam</span>
                    <span className="font-semibold text-slate-200">{sr.totalViews ?? 0} izlenme</span>
                  </div>
                  {sr.lastViewedAt && (
                    <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1.5">
                      <span className="text-muted">Son izleme</span>
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
      header: 'Kaynak',
      render: (r) => (
        <span className="text-xs font-mono text-muted" title={r.primaryUrl}>
          {r.primaryUrl.length > 40 ? r.primaryUrl.substring(0, 40) + '…' : r.primaryUrl}
        </span>
      ),
    },
    {
      key: 'server',
      header: 'Sunucu',
      className: 'w-28',
      render: (r) => <span className="text-xs text-slate-300">{r.server?.name ?? '—'}</span>,
    },
    {
      key: 'connections',
      header: 'İzleyici',
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
      header: 'Uptime',
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
      header: 'Sağlık',
      className: 'w-20',
      render: (r) => {
        const up = (r as Stream & { uptimePercent?: number | null }).uptimePercent;
        return <UptimeHealthBadge uptimePercent={up} />;
      },
    },
    {
      key: 'resolution',
      header: 'Çözünürlük / Kalite',
      className: 'w-36',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">{r.resolution ?? '—'}</span>
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
      ),
    },
    ...(showEpgColumn ? [{
      key: 'epg',
      header: 'Şu An',
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
      header: 'İşlemler',
      className: 'w-36',
      render: (r) => (
        <div className="flex items-center gap-0.5">
          {r.workerStatus !== 'RUNNING' && (
            <ActionBtn
              icon={Play} title="Başlat" color="text-green-400"
              onClick={() => startStream.mutate(r.id)}
              loading={startStream.isPending && startStream.variables === r.id}
            />
          )}
          {r.workerStatus === 'RUNNING' && (
            <ActionBtn
              icon={Square} title="Durdur" color="text-amber-400"
              onClick={() => stopStream.mutate(r.id)}
              loading={stopStream.isPending && stopStream.variables === r.id}
            />
          )}
          <ActionBtn
            icon={RotateCcw} title="Yeniden başlat" color="text-emerald-400"
            onClick={() => restart.mutate(r.id)}
            loading={restart.isPending && restart.variables === r.id}
          />
          <ActionBtn icon={Pencil} title="Düzenle" color="text-blue-400" onClick={() => {}} />
          <ActionBtn icon={Activity} title="Sağlık Raporu" color="text-emerald-400" onClick={() => setHealthStream({ id: r.id, name: r.name })} />
          <ActionBtn icon={Trash2} title="Sil" color="text-red-400" onClick={() => setDeleteId(r.id)} />
          <ActionBtn icon={Eye} title="URL Göster" color="text-muted" onClick={() => setPreviewInfo({ token: '', previewProxyUrl: '', hlsUrl: r.primaryUrl, name: r.name, streamMode: r.streamMode, externalId: r.externalId })} />
          {(!type || type === 'LIVE') && (
            <ActionBtn
              icon={Clapperboard}
              title="Stream Önizle"
              color="text-cyan-400"
              loading={previewLoading === r.id}
              onClick={() => {
                setPreviewLoading(r.id);
                api.get<{ success: boolean; data: PreviewInfo }>(`/streams/${r.id}/preview-url`)
                  .then((res) => { setPreviewInfo(res.data.data); })
                  .catch(() => toast.error('Önizleme başlatılamadı'))
                  .finally(() => setPreviewLoading(null));
              }}
            />
          )}
          <ActionBtn
            icon={Microscope}
            title="Kalite Analiz Et"
            color="text-purple-400"
            onClick={() => {
              api.post(`/streams/${r.id}/analyze`)
                .then(() => toast.success(`${r.name}: analiz başlatıldı`))
                .catch(() => toast.error('Analiz başlatılamadı'));
            }}
          />
          <ActionBtn
            icon={Copy}
            title="Klonla"
            color="text-sky-400"
            onClick={() => {
              api.post<{ success: boolean; data: { name: string } }>(`/streams/${r.id}/clone`)
                .then((res) => toast.success(`Klonlandı → ${res.data.data.name}`))
                .catch(() => toast.error('Klonlama başarısız'));
            }}
          />
          {(type === 'VOD' || type === 'SERIES') && (
            <ActionBtn
              icon={Sparkles}
              title="Meta Veri Çek"
              color="text-yellow-400"
              loading={enrichStream.isPending && (enrichStream.variables as { id: string } | undefined)?.id === r.id}
              onClick={() => enrichStream.mutate({ id: r.id, type })}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={`${data?.total ?? 0} kayıt`}
        actions={
          <>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                'btn-ghost flex items-center gap-1.5 text-xs',
                autoRefresh ? 'text-emerald-400' : '',
              )}
              title={autoRefresh ? 'Auto-Refresh: açık (5s)' : 'Auto-Refresh: kapalı'}
            >
              {autoRefresh ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span className="hidden sm:inline">Auto-Refresh</span>
            </button>
            <button onClick={handleRefresh} className="btn-ghost" title="Yenile">
              <RefreshCw className="w-4 h-4" />
            </button>
            {selectedStreamIds.size > 0 && (
              <button
                onClick={() => setShowBulkMove(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <FolderInput className="w-4 h-4" />
                {selectedStreamIds.size} Seçili Taşı
              </button>
            )}
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Kanal Ekle</span>
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
              placeholder="İsim veya URL ara…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input h-9 w-auto min-w-36" value={serverId} onChange={(e) => { setServerId(e.target.value); setPage(1); }}>
            <option value="">Tüm Sunucular</option>
            {servers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input h-9 w-auto min-w-36" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
            <option value="">Tüm Kategoriler</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input h-9 w-auto min-w-36" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tüm Durumlar</option>
            <option value="RUNNING">Çalışıyor</option>
            <option value="IDLE">Bekliyor</option>
            <option value="CRASHED">Hata</option>
            <option value="STOPPED">Durdu</option>
          </select>
          <button
            onClick={() => setShowAdvFilters((v) => !v)}
            className={cn('btn btn-ghost h-9 text-sm gap-1.5', (showAdvFilters || hasAdvFilters) && 'text-primary')}
          >
            <Filter className="w-3.5 h-3.5" />
            Gelişmiş
            {hasAdvFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {hasAdvFilters && (
            <button onClick={clearAdvFilters} className="btn btn-ghost h-9 text-xs text-muted hover:text-danger">
              Temizle
            </button>
          )}
        </div>

        {showAdvFilters && (
          <div className="flex flex-wrap gap-2.5 items-center border-t border-border pt-2.5">
            <select className="input h-9 w-auto min-w-32" value={resolution} onChange={(e) => { setResolution(e.target.value); setPage(1); }}>
              <option value="">Tüm Çözünürlükler</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
              <option value="360">360p</option>
            </select>
            <select className="input h-9 w-auto min-w-32" value={qualityScore} onChange={(e) => { setQualityScore(e.target.value); setPage(1); }}>
              <option value="">Tüm Kaliteler</option>
              <option value="A">A — Mükemmel</option>
              <option value="B">B — İyi</option>
              <option value="C">C — Orta</option>
              <option value="D">D — Düşük</option>
              <option value="F">F — Kötü</option>
            </select>
            <select className="input h-9 w-auto min-w-36" value={healthStatus} onChange={(e) => { setHealthStatus(e.target.value); setPage(1); }}>
              <option value="">Tüm Sağlık</option>
              <option value="HEALTHY">Sağlıklı</option>
              <option value="UNHEALTHY">Sorunlu</option>
              <option value="UNKNOWN">Bilinmiyor</option>
            </select>
            <select className="input h-9 w-auto min-w-28" value={videoCodec} onChange={(e) => { setVideoCodec(e.target.value); setPage(1); }}>
              <option value="">Tüm Codec</option>
              <option value="h264">H.264</option>
              <option value="h265">H.265 / HEVC</option>
              <option value="av1">AV1</option>
              <option value="vp9">VP9</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted whitespace-nowrap">Son güncelleme ≥</label>
              <select className="input h-9 w-auto" value={updatedAfter} onChange={(e) => { setUpdatedAfter(e.target.value); setPage(1); }}>
                <option value="">Her zaman</option>
                <option value={new Date(Date.now() - 86400000).toISOString()}>Bugün</option>
                <option value={new Date(Date.now() - 7 * 86400000).toISOString()}>Bu hafta</option>
                <option value={new Date(Date.now() - 30 * 86400000).toISOString()}>Bu ay</option>
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
              emptyTitle="Kayıt bulunamadı"
              emptyDescription="Arama kriterlerinize uygun kayıt yok."
              mobileCards
            />
          </SortableContext>
        </DndContext>
      </div>

      {/* Bulk move modal */}
      <Modal open={showBulkMove} onClose={() => setShowBulkMove(false)} title={`${selectedStreamIds.size} Stream Taşı`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">Hedef kategori seç:</p>
          <select
            className="input w-full"
            value={bulkMoveCatId}
            onChange={(e) => setBulkMoveCatId(e.target.value)}
          >
            <option value="">— Kategori seç —</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-secondary" onClick={() => setShowBulkMove(false)}>İptal</button>
            <button
              className="btn btn-primary"
              disabled={!bulkMoveCatId || bulkMoveCategory.isPending}
              onClick={async () => {
                await bulkMoveCategory.mutateAsync({ streamIds: [...selectedStreamIds], categoryId: bulkMoveCatId });
                setShowBulkMove(false);
                setSelectedStreamIds(new Set());
              }}
            >
              Taşı
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!previewInfo}
        onClose={() => setPreviewInfo(null)}
        title={previewInfo?.name ?? 'Stream Önizle'}
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
              <p className="text-xs text-muted mb-1">Kaynak URL</p>
              <p className="rounded-lg px-3 py-2.5 font-mono text-xs break-all bg-surface-2 text-fg border border-border">
                {previewInfo.hlsUrl}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { void navigator.clipboard.writeText(previewInfo.hlsUrl); toast.success('Kopyalandı'); }}
                className="btn-ghost text-xs text-blue-400 flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                URL Kopyala
              </button>
              <button onClick={() => setPreviewInfo(null)} className="btn-ghost text-xs flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                Kapat
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}
        title={`Yeni ${type === 'VOD' ? 'Film' : type === 'SERIES' ? 'Dizi' : 'Kanal'} Ekle`}
        size="md"
      >
        <div className="space-y-3">
          <div>
            <label className="label">Kanal Adı *</label>
            <input
              className="input"
              placeholder="Örn: TRT 1"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Kategori *</label>
            <select
              className="input"
              value={createForm.categoryId}
              onChange={(e) => setCreateForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Kategori seçin</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kaynak URL *</label>
            <input
              className="input font-mono text-xs"
              placeholder="http:// veya rtmp://"
              value={createForm.primaryUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, primaryUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Yedek URL</label>
            <input
              className="input font-mono text-xs"
              placeholder="Opsiyonel — yedek kaynak"
              value={createForm.backupUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, backupUrl: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Sunucu</label>
            <select
              className="input"
              value={createForm.serverId}
              onChange={(e) => setCreateForm((f) => ({ ...f, serverId: e.target.value }))}
            >
              <option value="">Sunucu seçin</option>
              {servers?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.ip}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Logo URL</label>
            <input
              className="input"
              placeholder="https://… (kanal logosu)"
              value={createForm.tvgLogo}
              onChange={(e) => setCreateForm((f) => ({ ...f, tvgLogo: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Yayın Modu</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PROXY', 'TRANSCODE'] as const).map((mode) => (
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
                    {mode === 'PROXY' ? 'Direkt Proxy' : 'FFmpeg Transcode'}
                    {mode === 'PROXY' && <span className="ml-1.5 text-emerald-400 text-[10px]">(önerilen)</span>}
                  </span>
                  <span className="text-[10px] leading-snug opacity-70">
                    {mode === 'PROXY'
                      ? 'Kaynak URL direkt iletilir — düşük kaynak tüketimi'
                      : 'FFmpeg ile HLS\'e çevrilir — kalite optimizasyonu'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button
              onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              disabled={
                createStream.isPending ||
                !createForm.name ||
                !createForm.primaryUrl ||
                !createForm.categoryId
              }
              onClick={() => {
                const payload = {
                  name: createForm.name,
                  primaryUrl: createForm.primaryUrl,
                  categoryId: createForm.categoryId,
                  type: type ?? 'LIVE',
                  streamMode: createForm.streamMode,
                  ...(createForm.backupUrl && { backupUrl: createForm.backupUrl }),
                  ...(createForm.serverId && { serverId: createForm.serverId }),
                  ...(createForm.tvgLogo && { tvgLogo: createForm.tvgLogo }),
                } as Partial<Stream> & { type: string };
                createStream.mutate(payload, {
                  onSuccess: () => { setShowCreate(false); setCreateForm(EMPTY_FORM); },
                });
              }}
              className="btn-primary"
            >
              {createStream.isPending ? 'Kaydediliyor…' : 'Kaydet'}
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
        title="Stream Sil"
        message="Bu stream kalıcı olarak silinecek. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        loading={deleteStream.isPending}
      />

      {/* Stream health modal */}
      {healthStream && (
        <StreamHealthModal
          streamId={healthStream.id}
          streamName={healthStream.name}
          onClose={() => setHealthStream(null)}
        />
      )}
    </div>
  );
}
