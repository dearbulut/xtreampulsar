import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  ShieldCheck,
  Wrench,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFixUsersOutput, useStreamsToJson, useSetStreamServer, useCleanDatabase, useRestartAllStreams, useReencodeVods, useBulkSeriesImport, useSystemStats, useIptvCheck, useFixStreamTypes, useRegroupSeries } from '@/hooks/useTools';
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
  | 'system-stats'
  | 'iptv-check'
  | 'fix-types'
  | 'regroup-series';

const TOOLS: { id: ToolId; icon: React.ElementType; label: string }[] = [
  { id: 'fix-users', icon: Users, label: 'Fix Users Output' },
  { id: 'streams-json', icon: Download, label: 'Streams URL to JSON' },
  { id: 'set-server', icon: Server, label: 'Set Stream Server' },
  { id: 'clean-db', icon: Database, label: 'Clean Database' },
  { id: 'restart-streams', icon: RotateCcw, label: 'Restart All Streams' },
  { id: 'reencode-vods', icon: Film, label: 'ReEncode VODs' },
  { id: 'bulk-series', icon: Package, label: 'Bulk Series Import' },
  { id: 'system-stats', icon: Activity, label: 'System Stats' },
  { id: 'iptv-check', icon: ShieldCheck, label: 'IPTV Checker' },
  { id: 'fix-types', icon: Wrench, label: 'Fix Stream Types' },
  { id: 'regroup-series', icon: Layers, label: 'Dizi Grupla (Regroup Series)' },
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
  const { t } = useTranslation();
  const mutation = useFixUsersOutput();

  return (
    <div>
      <PanelTitle icon={Users}>Fix Users Output</PanelTitle>
      <PanelDesc>{t('tools.fixUsersDesc')}</PanelDesc>
      <RunButton onClick={() => void mutation.mutateAsync()} loading={mutation.isPending}>
        {t('tools.fixUsersRun')}
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <SuccessBox>{t('tools.fixUsersSuccess', { count: mutation.data.fixed })}</SuccessBox>
      )}
    </div>
  );
}

// ─── Panel: Streams to JSON ──────────────────────────────────────────────────

function StreamsJsonPanel() {
  const { t } = useTranslation();
  const [streamType, setStreamType] = useState('ALL');
  const mutation = useStreamsToJson();

  return (
    <div>
      <PanelTitle icon={Download}>Streams URL to JSON</PanelTitle>
      <PanelDesc>{t('tools.streamsJsonDesc')}</PanelDesc>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.streamType')}</label>
          <select
            value={streamType}
            onChange={(e) => setStreamType(e.target.value)}
            className="w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">{t('tools.typeAll')}</option>
            <option value="LIVE">{t('tools.typeLive')}</option>
            <option value="VOD">VOD</option>
            <option value="SERIES">{t('tools.typeSeries')}</option>
          </select>
        </div>
        <RunButton
          onClick={() => void mutation.mutateAsync({ streamType })}
          loading={mutation.isPending}
        >
          <Download className="w-4 h-4" />
          {t('tools.jsonDownload')}
        </RunButton>
      </div>
    </div>
  );
}

// ─── Panel: Set Stream Server ────────────────────────────────────────────────

function SetStreamServerPanel() {
  const { t } = useTranslation();
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
      <PanelDesc>{t('tools.setServerDesc')}</PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.server')}</label>
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t('tools.selectServer')}</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.ip})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.streamType')}</label>
          <select
            value={streamType}
            onChange={(e) => setStreamType(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">{t('tools.typeAll')}</option>
            <option value="LIVE">{t('tools.typeLive')}</option>
            <option value="VOD">VOD</option>
            <option value="SERIES">{t('tools.typeSeries')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted">{t('tools.scope')}</label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
            <input
              type="radio"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
              className="accent-primary"
            />
            {t('tools.allStreams')}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-fg">
            <input
              type="radio"
              checked={mode === 'selected'}
              onChange={() => setMode('selected')}
              className="accent-primary"
            />
            {t('tools.selectedStreams')}
          </label>
        </div>
        {mode === 'selected' && (
          <div>
            <label className="block text-xs text-muted mb-1">
              {t('tools.streamIdsLabel')}
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
          {t('tools.apply')}
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <SuccessBox>{t('tools.setServerSuccess', { count: mutation.data.updated })}</SuccessBox>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Clean Database ───────────────────────────────────────────────────

const CLEAN_TARGETS: { key: string; labelKey: string }[] = [
  { key: 'orphan_streams', labelKey: 'tools.cleanOrphanStreams' },
  { key: 'dead_connections', labelKey: 'tools.cleanDeadConnections' },
  { key: 'old_logs', labelKey: 'tools.cleanOldLogs' },
  { key: 'empty_categories', labelKey: 'tools.cleanEmptyCategories' },
  { key: 'unused_epg', labelKey: 'tools.cleanUnusedEpg' },
];

function CleanDatabasePanel() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const mutation = useCleanDatabase();

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const handleRun = () => {
    if (selected.length === 0) return;
    const ok = window.confirm(
      t('tools.cleanConfirm', { count: selected.length }),
    );
    if (!ok) return;
    void mutation.mutateAsync({ targets: selected });
  };

  return (
    <div>
      <PanelTitle icon={Database}>Clean Database</PanelTitle>
      <PanelDesc>{t('tools.cleanDbDesc')}</PanelDesc>
      <div className="space-y-2 mb-5">
        {CLEAN_TARGETS.map((target) => (
          <label
            key={target.key}
            className="flex items-center gap-3 cursor-pointer text-sm text-fg"
          >
            <input
              type="checkbox"
              checked={selected.includes(target.key)}
              onChange={() => toggle(target.key)}
              className="accent-primary w-4 h-4"
            />
            {t(target.labelKey)}
          </label>
        ))}
      </div>
      <RunButton onClick={handleRun} loading={mutation.isPending} disabled={selected.length === 0}>
        {t('tools.clean')}
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-4 space-y-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            {t('tools.deletedRecords')}
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
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useRestartAllStreams();

  return (
    <div>
      <PanelTitle icon={RotateCcw}>Restart All Streams</PanelTitle>
      <PanelDesc>{t('tools.restartDesc')}</PanelDesc>
      <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-warning/10 border border-warning/30">
        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
        <p className="text-sm text-warning">{t('tools.restartWarning')}</p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-fg mb-4">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-primary w-4 h-4"
        />
        {t('tools.restartConfirmCheck')}
      </label>
      <RunButton
        onClick={() => void mutation.mutateAsync()}
        loading={mutation.isPending}
        disabled={!confirmed}
      >
        <RotateCcw className="w-4 h-4" />
        {t('tools.restart')}
      </RunButton>
      {mutation.isSuccess && mutation.data && (
        <SuccessBox>{t('tools.restartSuccess', { count: mutation.data.restarted })}</SuccessBox>
      )}
    </div>
  );
}

// ─── Panel: ReEncode VODs ────────────────────────────────────────────────────

const REENCODE_MODES: { value: string; labelKey: string }[] = [
  { value: 'all', labelKey: 'tools.reencodeModeAll' },
  { value: 'category', labelKey: 'tools.reencodeModeCategory' },
  { value: 'by_server', labelKey: 'tools.reencodeModeServer' },
  { value: 'down_only', labelKey: 'tools.reencodeModeDownOnly' },
  { value: 'ready_only', labelKey: 'tools.reencodeModeReadyOnly' },
];

function ReencodeVodsPanel() {
  const { t } = useTranslation();
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
      <PanelDesc>{t('tools.reencodeDesc')}</PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.mode')}</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {REENCODE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {t(m.labelKey)}
              </option>
            ))}
          </select>
        </div>
        {mode === 'category' && (
          <div>
            <label className="block text-xs text-muted mb-1">{t('tools.category')}</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t('tools.selectCategory')}</option>
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
            <label className="block text-xs text-muted mb-1">{t('tools.server')}</label>
            <select
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t('tools.selectServer')}</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.ip})
                </option>
              ))}
            </select>
          </div>
        )}
        <RunButton onClick={handleRun} loading={mutation.isPending}>
          {t('tools.addToQueue')}
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <SuccessBox>{t('tools.reencodeSuccess', { count: mutation.data.queued })}</SuccessBox>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Bulk Series Import ───────────────────────────────────────────────

function BulkSeriesImportPanel() {
  const { t } = useTranslation();
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
      <PanelDesc>{t('tools.bulkSeriesDesc')}</PanelDesc>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.category')}</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t('tools.selectCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.folderPath')}</label>
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
          {t('tools.specialCharEncoding')}
        </label>
        <RunButton
          onClick={handleImport}
          loading={mutation.isPending}
          disabled={!categoryId || !folderPath}
        >
          <Package className="w-4 h-4" />
          {t('tools.import')}
        </RunButton>
        {mutation.isSuccess && mutation.data && (
          <div className="flex gap-4 text-sm">
            <span className="text-muted">
              {t('tools.found')} <span className="font-bold text-fg">{mutation.data.found}</span>
            </span>
            <span className="text-muted">
              {t('tools.imported')} <span className="font-bold text-success">{mutation.data.imported}</span>
            </span>
          </div>
        )}
      </div>
      {logs.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted">
            <Terminal className="w-3 h-3" />
            <span>{t('tools.logs')}</span>
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

function formatUptime(seconds: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(t('tools.uptimeDays', { n: d }));
  if (h > 0) parts.push(t('tools.uptimeHours', { n: h }));
  parts.push(t('tools.uptimeMinutes', { n: m }));
  return parts.join(' ');
}

function FixStreamTypesPanel() {
  const { t } = useTranslation();
  const preview = useFixStreamTypes();
  const apply = useFixStreamTypes();
  const previewData = preview.data;

  return (
    <div>
      <PanelTitle icon={Wrench}>Fix Stream Types</PanelTitle>
      <PanelDesc>{t('tools.fixTypesDesc')}</PanelDesc>
      <div className="flex gap-2">
        <RunButton onClick={() => void preview.mutateAsync(true)} loading={preview.isPending}>
          {t('tools.fixTypesPreview')}
        </RunButton>
        {previewData && previewData.changed > 0 && (
          <button
            className="btn-primary"
            disabled={apply.isPending}
            onClick={() => void apply.mutateAsync(false)}
          >
            {t('tools.fixTypesApply', { count: previewData.changed })}
          </button>
        )}
      </div>

      {apply.isSuccess && apply.data && (
        <SuccessBox>{t('tools.fixTypesDone', { count: apply.data.changed })}</SuccessBox>
      )}

      {previewData && !apply.isSuccess && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">{t('tools.fixTypesResult', { checked: previewData.checked, changed: previewData.changed })}</p>
          {previewData.changed > 0 && (
            <div className="max-h-72 overflow-y-auto card divide-y divide-border">
              {previewData.details.slice(0, 200).map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="truncate text-fg max-w-md">{d.name}</span>
                  <span className="shrink-0 ml-2 tabular-nums">
                    <span className="badge badge-gray">{d.oldType}</span>
                    <span className="mx-1 text-muted">→</span>
                    <span className="badge badge-success">{d.newType}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegroupSeriesPanel() {
  const preview = useRegroupSeries();
  const apply = useRegroupSeries();
  const d = preview.data;

  return (
    <div>
      <PanelTitle icon={Layers}>Dizi Grupla (Regroup Series)</PanelTitle>
      <PanelDesc>
        M3U ile içe aktarılmış ve her bölümü ayrı satır olarak duran dizileri tek "Dizi → Sezon → Bölüm"
        yapısına toplar. Önce önizle; uygulanınca fazladan bölüm-stream'leri silinir ve Episode kayıtları oluşturulur.
      </PanelDesc>
      <div className="flex gap-2">
        <RunButton onClick={() => void preview.mutateAsync(true)} loading={preview.isPending}>
          Önizle
        </RunButton>
        {d && d.streamsToRemove > 0 && (
          <button
            className="btn-primary"
            disabled={apply.isPending}
            onClick={() => void apply.mutateAsync(false)}
          >
            Uygula ({d.seriesGroups} dizi, {d.streamsToRemove} satır sadeleşecek)
          </button>
        )}
      </div>

      {apply.isSuccess && apply.data && (
        <SuccessBox>
          {apply.data.seriesGroups} dizi toplandı, {apply.data.episodesToCreate} bölüm oluşturuldu,
          {' '}{apply.data.streamsToRemove} fazla satır kaldırıldı.
        </SuccessBox>
      )}

      {d && !apply.isSuccess && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">
            Tarandı: {d.scanned} · Dizi grubu: {d.seriesGroups} · Yeni dizi: {d.parentsToCreate} ·
            {' '}Bölüm: {d.episodesToCreate} · Kaldırılacak satır: {d.streamsToRemove}
          </p>
          {d.details.length > 0 && (
            <div className="max-h-72 overflow-y-auto card divide-y divide-border">
              {d.details.slice(0, 200).map((row, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="truncate text-fg max-w-md">{row.title}</span>
                  <span className="shrink-0 ml-2 flex items-center gap-2">
                    <span className="badge badge-gray">{row.category}</span>
                    <span className="badge badge-success tabular-nums">{row.episodes} bölüm</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IptvCheckPanel() {
  const { t } = useTranslation();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const check = useIptvCheck();
  const r = check.data;

  const submit = () => {
    if (!host.trim() || !username.trim() || !password.trim()) return;
    void check.mutateAsync({ host: host.trim(), username: username.trim(), password: password.trim() });
  };

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—');

  return (
    <div>
      <PanelTitle icon={ShieldCheck}>IPTV Checker</PanelTitle>
      <PanelDesc>{t('tools.iptvCheckDesc')}</PanelDesc>
      <div className="space-y-3 max-w-md">
        <div>
          <label className="block text-xs text-muted mb-1">{t('tools.iptvHost')}</label>
          <input className="input font-mono" value={host} onChange={(e) => setHost(e.target.value)} placeholder="http://panel.example.com:8080" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">{t('users.username')}</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">{t('users.password')}</label>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <RunButton onClick={submit} loading={check.isPending}>{t('tools.iptvCheckRun')}</RunButton>
      </div>

      {r && !r.ok && (
        <div className="mt-4 max-w-md rounded-lg border border-danger/30 bg-danger/10 text-danger text-sm px-4 py-3">
          {r.error}
        </div>
      )}
      {r && r.ok && (
        <div className="mt-4 max-w-md card p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">{t('tools.iptvStatus')}</span>
            <span className={cn('badge', r.auth && r.status === 'Active' ? 'badge-success' : 'badge-danger')}>
              {r.auth ? (r.status || 'Active') : t('tools.iptvInvalid')}
            </span>
          </div>
          {r.isTrial && <div className="flex justify-between"><span className="text-muted">{t('tools.iptvTrial')}</span><span className="badge badge-warning">Trial</span></div>}
          <div className="flex justify-between"><span className="text-muted">{t('tools.iptvExpiry')}</span><span className="tabular-nums">{fmt(r.expDate)}</span></div>
          <div className="flex justify-between"><span className="text-muted">{t('tools.iptvCreated')}</span><span className="tabular-nums">{fmt(r.createdAt)}</span></div>
          <div className="flex justify-between"><span className="text-muted">{t('tools.iptvConns')}</span><span className="tabular-nums">{r.activeCons ?? 0} / {r.maxConnections ?? '—'}</span></div>
          {r.serverUrl && <div className="flex justify-between"><span className="text-muted">{t('tools.iptvServer')}</span><span className="font-mono text-xs">{r.serverUrl}:{r.serverPort}</span></div>}
          {r.timezone && <div className="flex justify-between"><span className="text-muted">{t('tools.iptvTimezone')}</span><span className="text-xs">{r.timezone}</span></div>}
        </div>
      )}
    </div>
  );
}

function SystemStatsPanel() {
  const { t } = useTranslation();
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
          {t('tools.refresh')}
        </button>
      </div>
      <PanelDesc>{t('tools.systemStatsDesc')}</PanelDesc>

      {stats ? (
        <div className="space-y-6 max-w-sm">
          {/* Gauges */}
          <div className="space-y-3">
            <StatGauge label={t('tools.cpuLoad')} value={stats.cpuLoad} />
            <StatGauge label={t('tools.ramUsage')} value={stats.memUsedPct} />
          </div>

          {/* Memory detail */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted mb-0.5">{t('tools.totalRam')}</p>
              <p className="text-sm font-bold font-mono">
                {(stats.totalMemMb / 1024).toFixed(1)} GB
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted mb-0.5">{t('tools.freeRam')}</p>
              <p className="text-sm font-bold font-mono">
                {(stats.freeMemMb / 1024).toFixed(1)} GB
              </p>
            </div>
          </div>

          {/* Misc stats */}
          <div className="rounded-lg border border-border bg-surface-2 divide-y divide-border">
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">{t('tools.runningWorkers')}</span>
              <span className="font-mono font-bold">{stats.runningWorkers}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">{t('tools.database')}</span>
              {stats.dbConnected ? (
                <span className="flex items-center gap-1 text-success text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t('tools.connected')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('tools.notConnected')}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Redis</span>
              {stats.redisConnected ? (
                <span className="flex items-center gap-1 text-success text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t('tools.connected')}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-danger text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('tools.notConnected')}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3 text-sm">
              <span className="text-muted">Uptime</span>
              <span className="font-mono font-bold">
                {stats.uptimeFormatted ?? formatUptime(stats.uptime, t)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('tools.dataFetchFailed')}</p>
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
          {active === 'iptv-check' && <IptvCheckPanel />}
          {active === 'fix-types' && <FixStreamTypesPanel />}
          {active === 'regroup-series' && <RegroupSeriesPanel />}
        </div>
      </div>
    </div>
  );
}
