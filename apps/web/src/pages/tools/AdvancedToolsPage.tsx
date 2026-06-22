import { useState } from 'react';
import {
  Users,
  Download,
  Server,
  Database,
  RotateCcw,
  Film,
  Package,
  Activity,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFixUsersOutput,
  useStreamsToJson,
  useSetStreamServer,
  useCleanDatabase,
  useRestartAllStreams,
  useReencodeVods,
  useBulkSeriesImport,
  useSystemStats,
} from '@/hooks/useTools';
import { useServers } from '@/hooks/useServers';
import { useCategories } from '@/hooks/useCategories';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolId =
  | 'fix-users'
  | 'streams-json'
  | 'set-server'
  | 'clean-db'
  | 'restart-streams'
  | 'reencode-vods'
  | 'bulk-series'
  | 'system-stats';

const TOOLS: { id: ToolId; icon: React.ElementType; label: string }[] = [
  { id: 'fix-users', icon: Users, label: 'Fix Users Output' },
  { id: 'streams-json', icon: Download, label: 'Streams URL to JSON' },
  { id: 'set-server', icon: Server, label: 'Set Stream Server' },
  { id: 'clean-db', icon: Database, label: 'Clean Database' },
  { id: 'restart-streams', icon: RotateCcw, label: 'Restart All Streams' },
  { id: 'reencode-vods', icon: Film, label: 'ReEncode VODs' },
  { id: 'bulk-series', icon: Package, label: 'Bulk Series Import' },
  { id: 'system-stats', icon: Activity, label: 'System Stats' },
];

// ─── Shared sub-components ───────────────────────────────────────────────────

function PanelTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-base font-semibold text-fg">{children}</h2>
    </div>
  );
}

function PanelDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted mb-6">{children}</p>;
}

function RunButton({
  onClick,
  loading,
  disabled,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-success/10 border border-success/30 text-success text-sm">
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function StatGauge({ label, value, unit = '%' }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-bold">
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            value > 80 ? 'bg-danger' : value > 60 ? 'bg-warning' : 'bg-success',
          )}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Panel: Fix Users Output ─────────────────────────────────────────────────

function FixUsersPanel() {
  const mutation = useFixUsersOutput();

  return (
    <div>
      <PanelTitle icon={Users}>Fix Users Output</PanelTitle>
      <PanelDesc>
        Tüm kullanıcıların output sayılarını veritabanındaki aktif bağlantı sayılarına göre
        yeniden hesaplar ve düzeltir.
      </PanelDesc>
      <RunButton onClick={() => void mutation.mutateAsync()} loading={mutation.isPending}>
        Düzelt
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <SuccessBox>{mutation.data.fixed} kullanıcı düzeltildi</SuccessBox>
      )}
    </div>
  );
}

// ─── Panel: Streams to JSON ──────────────────────────────────────────────────

function StreamsJsonPanel() {
  const [streamType, setStreamType] = useState('ALL');
  const mutation = useStreamsToJson();

  return (
    <div>
      <PanelTitle icon={Download}>Streams URL to JSON</PanelTitle>
      <PanelDesc>
        Seçili stream tipine göre tüm stream URL'lerini JSON formatında dışa aktarır.
      </PanelDesc>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Stream Tipi</label>
          <select
            value={streamType}
            onChange={(e) => setStreamType(e.target.value)}
            className="w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Tümü</option>
            <option value="LIVE">Canlı (LIVE)</option>
            <option value="VOD">VOD</option>
            <option value="SERIES">Dizi (SERIES)</option>
          </select>
        </div>
        <RunButton
          onClick={() => void mutation.mutateAsync({ streamType })}
          loading={mutation.isPending}
        >
          <Download className="w-4 h-4" />
          JSON İndir
        </RunButton>
      </div>
    </div>
  );
}

// ─── Panel: Set Stream Server ────────────────────────────────────────────────

function SetStreamServerPanel() {
  const { data: servers = [] } = useServers();
  const [serverId, setServerId] = useState('');
  const [streamType, setStreamType] = useState('ALL');
  const [mode, setMode] = useState<'all' | 'selected'>('all');
  const [idsText, setIdsText] = useState('');
  const mutation = useSetStreamServer();

  const handleApply = () => {
    if (!serverId) return;
    const streamIds =
      mode === 'selected'
        ? idsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    void mutation.mutateAsync({ serverId, streamIds, streamType });
  };

  return (
    <div>
      <PanelTitle icon={Server}>Set Stream Server</PanelTitle>
      <PanelDesc>
        Seçili stream'leri veya tüm stream'leri belirli bir sunucuya atar.
      </PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">Sunucu</label>
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">-- Sunucu seçin --</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.ip})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Stream Tipi</label>
          <select
            value={streamType}
            onChange={(e) => setStreamType(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">Tümü</option>
            <option value="LIVE">Canlı (LIVE)</option>
            <option value="VOD">VOD</option>
            <option value="SERIES">Dizi (SERIES)</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted">Kapsam</label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
            <input
              type="radio"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="accent-primary"
            />
            Tüm Stream'ler
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
            <input
              type="radio"
              checked={mode === 'selected'}
              onChange={() => setMode('selected')}
              className="accent-primary"
            />
            Seçili Stream'ler
          </label>
        </div>
        {mode === 'selected' && (
          <div>
            <label className="block text-xs text-muted mb-1">
              Stream ID'leri (virgülle ayırın)
            </label>
            <textarea
              value={idsText}
              onChange={(e) => setIdsText(e.target.value)}
              rows={3}
              placeholder="id1, id2, id3..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        )}
        <RunButton onClick={handleApply} loading={mutation.isPending} disabled={!serverId}>
          Uygula
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <SuccessBox>{mutation.data.updated} stream güncellendi</SuccessBox>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Clean Database ───────────────────────────────────────────────────

const CLEAN_TARGETS: { key: string; label: string }[] = [
  { key: 'orphan_streams', label: "Sahipsiz Stream'ler (kategorisi olmayan)" },
  { key: 'dead_connections', label: 'Ölü Bağlantılar (24 saatten eski)' },
  { key: 'old_logs', label: 'Eski Loglar (30 günden eski)' },
  { key: 'empty_categories', label: 'Boş Kategoriler' },
  { key: 'unused_epg', label: 'Kullanılmayan EPG Kanalları' },
];

function CleanDatabasePanel() {
  const [selected, setSelected] = useState<string[]>([]);
  const mutation = useCleanDatabase();

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const handleRun = () => {
    if (selected.length === 0) return;
    const ok = window.confirm(
      `${selected.length} hedef temizlenecek. Devam etmek istiyor musunuz?`,
    );
    if (!ok) return;
    void mutation.mutateAsync({ targets: selected });
  };

  return (
    <div>
      <PanelTitle icon={Database}>Clean Database</PanelTitle>
      <PanelDesc>
        Veritabanındaki gereksiz ve sahipsiz kayıtları temizler. İşlem geri alınamaz.
      </PanelDesc>
      <div className="space-y-2 mb-5">
        {CLEAN_TARGETS.map((t) => (
          <label
            key={t.key}
            className="flex items-center gap-3 cursor-pointer text-sm text-fg"
          >
            <input
              type="checkbox"
              checked={selected.includes(t.key)}
              onChange={() => toggle(t.key)}
              className="accent-primary w-4 h-4"
            />
            {t.label}
          </label>
        ))}
      </div>
      <RunButton onClick={handleRun} loading={mutation.isPending} disabled={selected.length === 0}>
        Temizle
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4 space-y-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Silinen Kayıtlar
          </p>
          {Object.entries(mutation.data.deleted).map(([key, count]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-fg">{key}</span>
              <span className="font-mono text-muted">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel: Restart All Streams ──────────────────────────────────────────────

function RestartStreamsPanel() {
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useRestartAllStreams();

  return (
    <div>
      <PanelTitle icon={RotateCcw}>Restart All Streams</PanelTitle>
      <PanelDesc>
        Tüm aktif stream worker'larını durdurur ve yeniden başlatır.
      </PanelDesc>
      <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
        <p className="text-sm text-warning">
          Tüm aktif stream worker'ları yeniden başlatılacak. Bu işlem sırasında kısa süreli
          kesinti yaşanabilir.
        </p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-fg mb-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-primary w-4 h-4"
        />
        Evet, tüm stream'leri yeniden başlat
      </label>
      <RunButton
        onClick={() => void mutation.mutateAsync()}
        loading={mutation.isPending}
        disabled={!confirmed}
      >
        <RotateCcw className="w-4 h-4" />
        Yeniden Başlat
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <SuccessBox>{mutation.data.restarted} worker yeniden başlatıldı</SuccessBox>
      )}
    </div>
  );
}

// ─── Panel: ReEncode VODs ────────────────────────────────────────────────────

const REENCODE_MODES: { value: string; label: string }[] = [
  { value: 'all', label: 'Tümünü Yeniden Encode Et' },
  { value: 'category', label: 'Kategoriye Göre' },
  { value: 'by_server', label: 'Sunucuya Göre' },
  { value: 'down_only', label: 'Yalnızca Çevrimdışı Olanlar' },
  { value: 'ready_only', label: 'Yalnızca Hazır Olanlar' },
];

function ReencodeVodsPanel() {
  const { data: servers = [] } = useServers();
  const { data: categories = [] } = useCategories('VOD');
  const [mode, setMode] = useState('all');
  const [categoryId, setCategoryId] = useState('');
  const [serverId, setServerId] = useState('');
  const mutation = useReencodeVods();

  const handleRun = () => {
    void mutation.mutateAsync({
      mode,
      categoryId: mode === 'category' ? categoryId : undefined,
      serverId: mode === 'by_server' ? serverId : undefined,
    });
  };

  return (
    <div>
      <PanelTitle icon={Film}>ReEncode VODs</PanelTitle>
      <PanelDesc>VOD içeriklerini yeniden encode kuyruğuna ekler.</PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">Mod</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {REENCODE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {mode === 'category' && (
          <div>
            <label className="block text-xs text-muted mb-1">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Kategori seçin --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {mode === 'by_server' && (
          <div>
            <label className="block text-xs text-muted mb-1">Sunucu</label>
            <select
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Sunucu seçin --</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.ip})
                </option>
              ))}
            </select>
          </div>
        )}
        <RunButton onClick={handleRun} loading={mutation.isPending}>
          Kuyruğa Ekle
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <SuccessBox>{mutation.data.queued} VOD kuyruğa eklendi</SuccessBox>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Bulk Series Import ───────────────────────────────────────────────

function BulkSeriesImportPanel() {
  const { data: categories = [] } = useCategories('SERIES');
  const [categoryId, setCategoryId] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [specialCharEncoding, setSpecialCharEncoding] = useState(false);
  const mutation = useBulkSeriesImport();

  const logs = mutation.data?.logs ?? [];

  const handleImport = () => {
    if (!categoryId || !folderPath) return;
    void mutation.mutateAsync({ categoryId, folderPath, specialCharEncoding });
  };

  return (
    <div>
      <PanelTitle icon={Package}>Bulk Series Import</PanelTitle>
      <PanelDesc>
        Belirtilen klasördeki dizi dosyalarını seçili kategoriye toplu olarak aktarır.
      </PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">Kategori</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">-- Kategori seçin --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Klasör Yolu</label>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/var/media/series"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
          <input
            type="checkbox"
            checked={specialCharEncoding}
            onChange={(e) => setSpecialCharEncoding(e.target.checked)}
            className="accent-primary w-4 h-4"
          />
          Özel karakter encoding kullan
        </label>
        <RunButton
          onClick={handleImport}
          loading={mutation.isPending}
          disabled={!categoryId || !folderPath}
        >
          <Package className="w-4 h-4" />
          İçe Aktar
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <div className="flex gap-4 text-sm">
            <span className="text-muted">
              Bulunan: <span className="font-bold text-fg">{mutation.data.found}</span>
            </span>
            <span className="text-muted">
              Aktarılan: <span className="font-bold text-success">{mutation.data.imported}</span>
            </span>
          </div>
        )}
      </div>
      {logs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted">
            <Terminal className="w-3 h-3" />
            <span>Loglar</span>
          </div>
          <div className="bg-black rounded-lg p-4 font-mono text-xs text-green-400 h-48 overflow-y-auto space-y-0.5">
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: System Stats ─────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} gün`);
  if (h > 0) parts.push(`${h} saat`);
  parts.push(`${m} dak`);
  return parts.join(' ');
}

function SystemStatsPanel() {
  const { data: stats, isLoading, refetch, isFetching } = useSystemStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <PanelTitle icon={Activity}>System Stats</PanelTitle>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-muted hover:text-fg transition-colors"
        >
          <RefreshCw className={cn('w-3 h-3', isFetching && 'animate-spin')} />
          Yenile
        </button>
      </div>
      <PanelDesc>Sistem kaynakları her 10 saniyede otomatik yenilenir.</PanelDesc>

      {stats ? (
        <div className="space-y-6 max-w-sm">
          {/* Gauges */}
          <div className="space-y-3">
            <StatGauge label="CPU Yükü" value={stats.cpuLoad} />
            <StatGauge label="RAM Kullanımı" value={stats.memUsedPct} />
          </div>

          {/* Memory detail */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted mb-0.5">Toplam RAM</p>
              <p className="text-sm font-bold font-mono">
                {(stats.totalMemMb / 1024).toFixed(1)} GB
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted mb-0.5">Boş RAM</p>
              <p className="text-sm font-bold font-mono">
                {(stats.freeMemMb / 1024).toFixed(1)} GB
              </p>
            </div>
          </div>

          {/* Misc stats */}
          <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border">
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Çalışan Worker'lar</span>
              <span className="font-mono font-bold">{stats.runningWorkers}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Veritabanı</span>
              {stats.dbConnected ? (
                <span className="flex items-center gap-1 text-success text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Bağlı
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Bağlı Değil
                </span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Redis</span>
              {stats.redisConnected ? (
                <span className="flex items-center gap-1 text-success text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Bağlı
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Bağlı Değil
                </span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Uptime</span>
              <span className="font-mono font-bold">
                {stats.uptimeFormatted ?? formatUptime(stats.uptime)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Veri alınamadı.</p>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function AdvancedToolsPage() {
  const [active, setActive] = useState<ToolId>('fix-users');

  return (
    <div className="flex gap-6 h-full">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0">
        <div className="card p-2 space-y-0.5">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActive(tool.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                active === tool.id
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              <tool.icon className="w-4 h-4 flex-shrink-0" />
              <span>{tool.label}</span>
              {active === tool.id && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1">
        <div className="card p-6">
          {active === 'fix-users' && <FixUsersPanel />}
          {active === 'streams-json' && <StreamsJsonPanel />}
          {active === 'set-server' && <SetStreamServerPanel />}
          {active === 'clean-db' && <CleanDatabasePanel />}
          {active === 'restart-streams' && <RestartStreamsPanel />}
          {active === 'reencode-vods' && <ReencodeVodsPanel />}
          {active === 'bulk-series' && <BulkSeriesImportPanel />}
          {active === 'system-stats' && <SystemStatsPanel />}
        </div>
      </div>
    </div>
  );
}
