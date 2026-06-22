import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useStreams, useRestartStream, useDeleteStream, useCreateStream } from '@/hooks/useStreams';
import { useCategories } from '@/hooks/useCategories';
import { useServers } from '@/hooks/useServers';
import type { Stream } from '@/types';
import { cn } from '@/lib/utils';

type StreamType = 'LIVE' | 'VOD' | 'SERIES';

const TYPE_TITLES: Record<StreamType, string> = {
  LIVE: 'Canlı Kanallar',
  VOD: 'VOD İçerikleri',
  SERIES: 'Dizi İçerikleri',
};

const WORKER_CFG = {
  RUNNING: { dot: 'bg-emerald-400', label: 'Çalışıyor', text: 'text-emerald-400' },
  CRASHED: { dot: 'bg-red-500',     label: 'Hata',       text: 'text-red-400' },
  STOPPED: { dot: 'bg-amber-400',   label: 'Durdu',      text: 'text-amber-400' },
  IDLE:    { dot: 'bg-gray-500',    label: 'Bekliyor',   text: 'text-gray-400' },
} as const;

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

interface CreateForm {
  name: string;
  categoryId: string;
  primaryUrl: string;
  backupUrl: string;
  serverId: string;
  tvgLogo: string;
}

const EMPTY_FORM: CreateForm = {
  name: '', categoryId: '', primaryUrl: '', backupUrl: '', serverId: '', tvgLogo: '',
};

function getUrlPage(): number {
  return Math.max(1, parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10));
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);

  const { data, isLoading, refetch } = useStreams({
    page, limit: 25, search, status, serverId, categoryId, type,
    refetchInterval: autoRefresh ? 5000 : false,
  });
  const { data: categories } = useCategories(type);
  const { data: servers } = useServers();
  const restart = useRestartStream();
  const deleteStream = useDeleteStream();
  const createStream = useCreateStream();

  const handleRefresh = useCallback(() => void refetch(), [refetch]);
  const pageTitle = type ? TYPE_TITLES[type] : "Stream'ler";

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
      render: (r) =>
        r.tvgLogo ? (
          <img
            src={r.tvgLogo}
            alt=""
            className="w-8 h-8 rounded-md object-cover border border-border bg-surface-2"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-md bg-surface-2 border border-border flex items-center justify-center">
            <Tv className="w-4 h-4 text-muted" />
          </div>
        ),
    },
    {
      key: 'workerStatus',
      header: 'Durum',
      className: 'w-28',
      render: (r) => {
        const cfg = WORKER_CFG[r.workerStatus] ?? WORKER_CFG.IDLE;
        return (
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
            <span className={cn('text-xs font-medium', cfg.text)}>{cfg.label}</span>
          </div>
        );
      },
    },
    {
      key: 'name',
      header: 'İsim',
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-slate-100">{r.name}</div>
          {r.category && <div className="text-xs text-muted mt-0.5">{r.category.name}</div>}
        </div>
      ),
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
      key: 'resolution',
      header: 'Çözünürlük',
      className: 'w-24',
      render: () => <span className="text-xs text-muted">—</span>,
    },
    {
      key: 'actions',
      header: 'İşlemler',
      className: 'w-36',
      render: (r) => (
        <div className="flex items-center gap-0.5">
          <ActionBtn
            icon={RotateCcw} title="Yeniden başlat" color="text-emerald-400"
            onClick={() => restart.mutate(r.id)}
            loading={restart.isPending && restart.variables === r.id}
          />
          <ActionBtn icon={Pencil} title="Düzenle" color="text-blue-400" onClick={() => {}} />
          <ActionBtn icon={Square} title="Durdur" color="text-amber-400" onClick={() => {}} />
          <ActionBtn icon={Trash2} title="Sil" color="text-red-400" onClick={() => setDeleteId(r.id)} />
          <ActionBtn icon={Eye} title="Önizle" color="text-muted" onClick={() => setPreviewUrl(r.primaryUrl)} />
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
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Kanal Ekle</span>
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            className="input pl-9 h-9"
            placeholder="İsim veya URL ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input h-9 w-auto min-w-36"
          value={serverId}
          onChange={(e) => { setServerId(e.target.value); setPage(1); }}
        >
          <option value="">Tüm Sunucular</option>
          {servers?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className="input h-9 w-auto min-w-36"
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
        >
          <option value="">Tüm Kategoriler</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="input h-9 w-auto min-w-36"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Tüm Durumlar</option>
          <option value="RUNNING">Çalışıyor</option>
          <option value="IDLE">Bekliyor</option>
          <option value="CRASHED">Hata</option>
          <option value="STOPPED">Durdu</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          page={page}
          totalPages={data?.totalPages}
          total={data?.total}
          onPageChange={setPage}
          emptyTitle="Kayıt bulunamadı"
          emptyDescription="Arama kriterlerinize uygun kayıt yok."
        />
      </div>

      {/* Preview modal */}
      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)} title="Stream URL" size="md">
        <div
          className="rounded-lg p-4 font-mono text-xs break-all text-slate-200"
          style={{ backgroundColor: '#1c1f2e', border: '1px solid #2e3347' }}
        >
          {previewUrl}
        </div>
        <div className="flex justify-end mt-4 gap-2">
          <button onClick={() => setPreviewUrl(null)} className="btn-ghost text-xs">Kapat</button>
          <button
            onClick={() => { void navigator.clipboard.writeText(previewUrl ?? ''); }}
            className="btn-ghost text-xs text-blue-400"
          >
            Kopyala
          </button>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }}
        title="Yeni Kanal Ekle"
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
                const payload: Partial<Stream> = {
                  name: createForm.name,
                  primaryUrl: createForm.primaryUrl,
                  categoryId: createForm.categoryId,
                  ...(createForm.backupUrl && { backupUrl: createForm.backupUrl }),
                  ...(createForm.serverId && { serverId: createForm.serverId }),
                  ...(createForm.tvgLogo && { tvgLogo: createForm.tvgLogo }),
                };
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
    </div>
  );
}
