import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useStreams, useRestartStream, useDeleteStream, useCreateStream } from '@/hooks/useStreams';
import type { Stream } from '@/types';
import { cn, truncate } from '@/lib/utils';

const STATUS_OPTS = ['', 'ONLINE', 'OFFLINE', 'ERROR', 'BUFFERING'];
const WORKER_OPTS = ['', 'RUNNING', 'IDLE', 'CRASHED', 'STOPPED'];

export function StreamsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', primaryUrl: '', categoryId: '' });

  const { data, isLoading, refetch } = useStreams({ page, limit: 25, search, status });
  const restart = useRestartStream();
  const deleteStream = useDeleteStream();
  const createStream = useCreateStream();

  // Auto-refresh (5s) when enabled
  const streamQuery = useStreams({ page, limit: 25, search, status });
  // Use refetchInterval via the hook options when autoRefresh is on
  void streamQuery;

  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  const columns: Column<Stream>[] = [
    {
      key: 'externalId',
      header: '#',
      className: 'font-mono text-muted w-16',
      render: (r) => <span className="text-xs font-mono text-muted">#{r.externalId}</span>,
    },
    {
      key: 'name',
      header: 'İsim',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          {r.tvgLogo ? (
            <img src={r.tvgLogo} alt="" className="w-6 h-6 rounded object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="w-6 h-6 rounded bg-surface-2 flex items-center justify-center">
              <Eye className="w-3 h-3 text-muted" />
            </div>
          )}
          <div>
            <div className="text-sm text-slate-200 font-medium">{r.name}</div>
            <div className="text-xs text-muted">{r.category?.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={r.status} />
          {r.workerStatus !== 'IDLE' && <StatusBadge status={r.workerStatus} />}
        </div>
      ),
    },
    {
      key: 'primaryUrl',
      header: 'Kaynak',
      render: (r) => (
        <span className="text-xs font-mono text-muted" title={r.primaryUrl}>
          {truncate(r.primaryUrl, 35)}
        </span>
      ),
    },
    {
      key: 'connections',
      header: 'İzleyen',
      className: 'text-center w-20',
      headerClassName: 'text-center',
      render: (r) => (
        <span className="text-sm font-semibold text-slate-200">{r._count?.connections ?? 0}</span>
      ),
    },
    {
      key: 'restartCount',
      header: 'Yeniden Başlatma',
      className: 'text-center w-24',
      headerClassName: 'text-center',
      render: (r) => (
        <span className={cn('text-sm', r.restartCount > 0 ? 'text-warning' : 'text-muted')}>
          {r.restartCount}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      className: 'w-40',
      render: (r) => (
        <div className="flex items-center gap-1">
          <ActionBtn icon={RotateCcw} title="Yeniden başlat" color="text-success"
            onClick={() => restart.mutate(r.id)} loading={restart.isPending && restart.variables === r.id} />
          <ActionBtn icon={Eye} title="Önizle" color="text-info"
            onClick={() => setPreviewUrl(r.primaryUrl)} />
          <ActionBtn icon={Pencil} title="Düzenle" color="text-muted" onClick={() => {}} />
          <ActionBtn icon={Square} title="Durdur" color="text-warning" onClick={() => {}} />
          <ActionBtn icon={Trash2} title="Sil" color="text-danger"
            onClick={() => setDeleteId(r.id)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stream'ler"
        description={`${data?.total ?? 0} stream`}
        actions={
          <>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn('btn-ghost flex items-center gap-1.5', autoRefresh && 'text-success')}
            >
              <ToggleLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Auto-refresh</span>
            </button>
            <button onClick={handleRefresh} className="btn-ghost" title="Yenile">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Stream Ekle</span>
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            className="input pl-9"
            placeholder="İsim veya URL ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto min-w-36"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Tüm Statuslar</option>
          {STATUS_OPTS.slice(1).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
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
          emptyTitle="Stream bulunamadı"
          emptyDescription="Arama kriterlerinize uygun stream yok."
        />
      </div>

      {/* Preview modal */}
      <Modal open={!!previewUrl} onClose={() => setPreviewUrl(null)} title="Stream URL" size="md">
        <div className="bg-surface-2 rounded-lg p-4 font-mono text-xs text-slate-300 break-all">
          {previewUrl}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => { navigator.clipboard.writeText(previewUrl ?? '').catch(() => {}); }}
            className="btn-ghost text-xs"
          >
            Kopyala
          </button>
        </div>
      </Modal>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yeni Stream" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">İsim</label>
            <input className="input" placeholder="Kanal adı" value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Kaynak URL</label>
            <input className="input" placeholder="rtmp:// veya http://" value={createForm.primaryUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, primaryUrl: e.target.value }))} />
          </div>
          <div>
            <label className="label">Kategori ID</label>
            <input className="input" placeholder="Kategori ID" value={createForm.categoryId}
              onChange={(e) => setCreateForm((f) => ({ ...f, categoryId: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">İptal</button>
            <button
              disabled={createStream.isPending}
              onClick={() => {
                if (createForm.name && createForm.primaryUrl && createForm.categoryId) {
                  createStream.mutate(createForm, {
                    onSuccess: () => setShowCreate(false),
                  });
                }
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
        onConfirm={() => { if (deleteId) deleteStream.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title="Stream Sil"
        message="Bu stream kalıcı olarak silinecek. Bu işlem geri alınamaz."
        confirmLabel="Sil"
        loading={deleteStream.isPending}
      />
    </div>
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
      className={cn(
        'p-1.5 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50',
        color,
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
    </button>
  );
}
