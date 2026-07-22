import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Ban, RefreshCw, AlertTriangle, Globe, ScrollText, ShieldAlert, Save, Play, Gavel, Radar } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useBlockedIPs, useBruteForceLogs, useUnblockIP, useBlockIP, useAuditLogs, useBlockedAttempts, useAutoBanConfig, useUpdateAutoBan, useRunAutoBan, useSuspiciousLines, useRestreamConfig, useUpdateRestreamConfig, useBanLine, type BlockedIP, type BruteForceLog, type AuditLog, type BlockedAttempt, type AutoBanConfig, type SuspiciousLine, type RestreamConfig } from '@/hooks/useSecurity';
import { cn } from '@/lib/utils';

export function SecurityPage() {
  const { t } = useTranslation();
  const SECURITY_TABS: TabItem[] = [
    { id: 'blocks', label: t('security.tabBlocks') },
    { id: 'bruteforce', label: t('security.tabBruteForce') },
    { id: 'audit', label: t('security.tabAudit'), icon: ScrollText },
    { id: 'accessBlocks', label: t('security.tabAccessBlocks'), icon: ShieldAlert },
    { id: 'restream', label: t('security.tabRestream'), icon: Radar },
  ];
  const [activeTab, setActiveTab] = useState('blocks');
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ ip: '', reason: '', durationMinutes: '0' });
  const [auditPage, setAuditPage] = useState(1);

  const { data: blocks = [], isLoading: bLoading } = useBlockedIPs();
  const { data: bfLogs = [], isLoading: bfLoading } = useBruteForceLogs();
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ page: auditPage, limit: 50 });
  const unblock = useUnblockIP();
  const blockIP = useBlockIP();
  const [abCategory, setAbCategory] = useState('');
  const { data: abData, isLoading: abLoading } = useBlockedAttempts(abCategory || undefined);
  const AB_CAT_BADGE: Record<string, string> = {
    VPN_BLOCKED: 'badge-danger', DEVICE_LOCKED: 'badge-danger',
    COUNTRY_BLOCKED: 'badge-warning', IP_NOT_ALLOWED: 'badge-warning',
    MAX_CONN: 'badge-primary', IP_CAP: 'badge-primary',
  };
  const attemptColumns: Column<BlockedAttempt>[] = [
    { key: 'createdAt', header: t('security.time'), render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'category', header: t('security.reason'), render: (r) => (
      <span className={cn('badge', AB_CAT_BADGE[r.category] ?? 'badge')}>{t(`security.cat.${r.category}`, r.category)}</span>
    ) },
    { key: 'username', header: t('security.user'), render: (r) => <span className="font-mono text-xs">{r.username ?? '\u2014'}</span> },
    { key: 'ip', header: 'IP', render: (r) => <span className="font-mono text-xs">{r.ip ?? '\u2014'}</span> },
    { key: 'country', header: t('security.country'), render: (r) => r.country ?? '\u2014' },
  ];

  const handleUnblock = async (ip: string) => {
    if (!confirm(t('security.unblockConfirm', { ip }))) return;
    await unblock.mutateAsync(ip);
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await blockIP.mutateAsync({
      ip: blockForm.ip,
      reason: blockForm.reason,
      durationMinutes: parseInt(blockForm.durationMinutes, 10) || undefined,
    });
    setShowBlock(false);
    setBlockForm({ ip: '', reason: '', durationMinutes: '0' });
  };

  const blockColumns: Column<BlockedIP>[] = [
    {
      key: 'ip',
      header: t('security.ipAddress'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          <span className="font-mono text-sm text-slate-200">{row.ip}</span>
          {row.country && (
            <span className="badge badge-gray text-[10px]">{row.country}</span>
          )}
        </div>
      ),
    },
    { key: 'reason', header: t('security.reason'), render: (row) => <span className="text-sm text-slate-400">{row.reason}</span> },
    {
      key: 'blockedAt',
      header: t('security.blockedAt'),
      render: (row) =>
        new Date(row.blockedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'expiresAt',
      header: t('security.expiresAt'),
      render: (row) =>
        row.expiresAt
          ? new Date(row.expiresAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : <span className="text-xs text-muted">{t('security.indefinite')}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row) => (
        <button
          onClick={() => void handleUnblock(row.ip)}
          disabled={unblock.isPending}
          className="btn btn-ghost py-1 px-2 text-xs text-warning hover:text-warning"
        >
          <RefreshCw className="w-3 h-3 mr-1" /> {t('security.unblock')}
        </button>
      ),
    },
  ];

  const bfColumns: Column<BruteForceLog>[] = [
    {
      key: 'ip',
      header: t('security.ipAddress'),
      render: (row) => <span className="font-mono text-sm text-slate-200">{row.ip}</span>,
    },
    {
      key: 'attempts',
      header: t('security.attempts'),
      render: (row) => (
        <span className={cn('text-sm font-semibold', row.attempts > 20 ? 'text-danger' : row.attempts > 10 ? 'text-warning' : 'text-slate-400')}>
          {row.attempts}
        </span>
      ),
    },
    {
      key: 'lastAttempt',
      header: t('security.lastAttempt'),
      render: (row) =>
        new Date(row.lastAttempt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'blocked',
      header: t('common.status'),
      render: (row) => (
        <span className={cn('badge', row.blocked ? 'badge-danger' : 'badge-warning')}>
          {row.blocked ? t('security.blocked') : t('security.monitoring')}
        </span>
      ),
    },
  ];

  const auditColumns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: t('security.date'),
      render: (row) => (
        <span className="text-xs text-muted font-mono">
          {new Date(row.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
    {
      key: 'actorId',
      header: t('security.user'),
      render: (row) => (
        <span className="text-sm font-mono text-slate-300">{row.actorId ?? <span className="text-muted">—</span>}</span>
      ),
    },
    {
      key: 'action',
      header: t('security.action'),
      render: (row) => {
        const colorMap: Record<string, string> = {
          CREATE: 'badge-success',
          UPDATE: 'badge-warning',
          DELETE: 'badge-danger',
          LOGIN: 'bg-primary/10 text-primary-light',
          LOGOUT: 'badge-gray',
        };
        return <span className={cn('badge text-[10px]', colorMap[row.action] ?? 'badge-gray')}>{row.action}</span>;
      },
    },
    {
      key: 'entityType',
      header: 'Resource',
      render: (row) => (
        <div>
          <span className="text-sm text-slate-300">{row.entityType}</span>
          {row.entityId && <span className="text-xs text-muted font-mono ml-1">#{row.entityId.slice(-8)}</span>}
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (row) => <span className="font-mono text-xs text-muted">{row.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.security')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('security.subtitle')}</p>
        </div>
        <button onClick={() => setShowBlock(true)} className="btn btn-danger">
          <Ban className="w-4 h-4" /> {t('security.blockIP')}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('security.statActiveBlocks'), value: blocks.length, icon: Shield, color: 'text-danger', bg: 'bg-danger/10' },
          { label: t('security.statBruteForce'), value: bfLogs.filter((l) => l.blocked).length, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
          { label: t('security.statMonitoredIP'), value: bfLogs.filter((l) => !l.blocked).length, icon: Globe, color: 'text-primary-light', bg: 'bg-primary/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-200">{value}</div>
              <div className="text-xs text-muted">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs tabs={SECURITY_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'blocks' && (
        <DataTable
          columns={blockColumns}
          data={blocks}
          isLoading={bLoading}
          emptyMessage={t('security.emptyBlocks')}
        />
      )}

      {activeTab === 'bruteforce' && (
        <DataTable
          columns={bfColumns}
          data={bfLogs}
          isLoading={bfLoading}
          emptyMessage={t('security.emptyBruteForce')}
        />
      )}

      {activeTab === 'audit' && (
        <DataTable
          columns={auditColumns}
          data={auditData?.items ?? []}
          keyExtractor={(r) => r.id}
          isLoading={auditLoading}
          page={auditPage}
          totalPages={auditData?.totalPages}
          total={auditData?.total}
          onPageChange={setAuditPage}
          emptyTitle={t('security.emptyAuditTitle')}
          emptyDescription={t('security.emptyAuditDesc')}
        />
      )}

      {activeTab === 'accessBlocks' && (
        <div>
          <AutoBanCard />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['', 'VPN_BLOCKED', 'COUNTRY_BLOCKED', 'IP_NOT_ALLOWED', 'DEVICE_LOCKED', 'MAX_CONN', 'IP_CAP'].map((c) => (
              <button key={c || 'all'} onClick={() => setAbCategory(c)}
                className={cn('px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1.5', abCategory === c ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}>
                {c ? t(`security.cat.${c}`, c) : t('security.allCategories')}
                {c && abData?.categories?.[c] ? <span className="text-xs opacity-70">{abData.categories[c]}</span> : null}
              </button>
            ))}
          </div>
          <DataTable
            columns={attemptColumns}
            data={abData?.items ?? []}
            keyExtractor={(r) => r.id}
            isLoading={abLoading}
            emptyMessage={t('security.emptyAccessBlocks')}
          />
        </div>
      )}

      {activeTab === 'restream' && <RestreamTab />}

      <Modal open={showBlock} onClose={() => setShowBlock(false)} title={t('security.blockIP')} size="sm">
        <form onSubmit={(e) => { void handleBlock(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">{t('security.ipAddress')}</label>
            <input
              required
              className="input font-mono"
              value={blockForm.ip}
              onChange={(e) => setBlockForm((p) => ({ ...p, ip: e.target.value }))}
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="label">{t('security.reason')}</label>
            <input
              required
              className="input"
              value={blockForm.reason}
              onChange={(e) => setBlockForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder={t('security.reasonPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('security.durationLabel')}</label>
            <input
              type="number"
              className="input"
              value={blockForm.durationMinutes}
              onChange={(e) => setBlockForm((p) => ({ ...p, durationMinutes: e.target.value }))}
              min="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowBlock(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-danger" disabled={blockIP.isPending}>{t('security.block')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


function AutoBanCard() {
  const { t } = useTranslation();
  const { data: cfg } = useAutoBanConfig();
  const update = useUpdateAutoBan();
  const run = useRunAutoBan();
  const [form, setForm] = useState<AutoBanConfig | null>(null);
  const [runResult, setRunResult] = useState<{ scanned: number; banned: number } | null>(null);
  useEffect(() => { if (cfg && !form) setForm(cfg); }, [cfg, form]);
  if (!form) return null;

  const num = (k: keyof AutoBanConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: Math.max(1, parseInt(e.target.value, 10) || 1) });

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gavel className="w-4 h-4 text-primary" /> {t('security.autoBan.title')}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-muted">{form.enabled ? t('security.autoBan.on') : t('security.autoBan.off')}</span>
          <input type="checkbox" className="toggle" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
        </label>
      </div>
      <p className="text-xs text-muted mb-4">{t('security.autoBan.hint')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">{t('security.autoBan.threshold')}</label>
          <input type="number" min={1} className="input" value={form.threshold} onChange={num('threshold')} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('security.autoBan.windowMins')}</label>
          <input type="number" min={1} className="input" value={form.windowMins} onChange={num('windowMins')} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('security.autoBan.durationMins')}</label>
          <input type="number" min={1} className="input" value={form.durationMins} onChange={num('durationMins')} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button className="btn-primary inline-flex items-center gap-1.5" disabled={update.isPending}
          onClick={() => update.mutate(form)}>
          <Save className="w-3.5 h-3.5" /> {update.isPending ? t('common.loading') : t('common.save')}
        </button>
        <button className="btn-ghost border border-border inline-flex items-center gap-1.5" disabled={run.isPending}
          onClick={() => run.mutate(undefined, { onSuccess: (r) => setRunResult({ scanned: r.scanned, banned: r.banned }) })}>
          <Play className="w-3.5 h-3.5" /> {run.isPending ? t('common.loading') : t('security.autoBan.runNow')}
        </button>
        {runResult && (
          <span className="text-xs text-muted">{t('security.autoBan.runResult', { scanned: runResult.scanned, banned: runResult.banned })}</span>
        )}
      </div>
    </div>
  );
}

function RestreamTab() {
  const { t } = useTranslation();
  const { data: cfg } = useRestreamConfig();
  const update = useUpdateRestreamConfig();
  const banLine = useBanLine();
  const [form, setForm] = useState<RestreamConfig | null>(null);
  useEffect(() => { if (cfg && !form) setForm(cfg); }, [cfg, form]);

  const win = form?.restreamWindowMins ?? 60;
  const th = form?.restreamDistinctThreshold ?? 40;
  const { data: lines = [], isLoading } = useSuspiciousLines(win, th);

  const cols: Column<SuspiciousLine>[] = [
    { key: 'username', header: t('security.restream.line'), render: (r) => <span className="font-medium">{r.username}</span> },
    { key: 'distinctStreams', header: t('security.restream.distinct'), render: (r) => <span className="font-bold text-danger tabular-nums">{r.distinctStreams}</span> },
    { key: 'totalConns', header: t('security.restream.total'), render: (r) => <span className="tabular-nums text-muted">{r.totalConns}</span> },
    { key: 'avgSecs', header: t('security.restream.avg'), render: (r) => <span className="tabular-nums text-muted">{r.avgSecs}sn</span> },
    { key: 'status', header: t('security.restream.status'), render: (r) => <span className={cn('text-xs px-2 py-0.5 rounded', r.status === 'BANNED' ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success')}>{r.status}</span> },
    {
      key: 'actions', header: '', render: (r) => r.status !== 'BANNED' ? (
        <button className="btn-ghost text-xs text-danger inline-flex items-center gap-1" onClick={() => banLine.mutate(r.userId)}>
          <Ban className="w-3.5 h-3.5" /> {t('security.restream.ban')}
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      {form && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Radar className="w-4 h-4 text-primary" /> {t('security.restream.title')}</div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted">{form.restreamDetectEnabled ? t('security.autoBan.on') : t('security.autoBan.off')}</span>
              <input type="checkbox" className="toggle" checked={form.restreamDetectEnabled} onChange={(e) => setForm({ ...form, restreamDetectEnabled: e.target.checked })} />
            </label>
          </div>
          <p className="text-xs text-muted mb-4">{t('security.restream.hint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">{t('security.restream.window')}</label>
              <input type="number" min={5} className="input" value={form.restreamWindowMins} onChange={(e) => setForm({ ...form, restreamWindowMins: Math.max(5, parseInt(e.target.value, 10) || 5) })} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">{t('security.restream.threshold')}</label>
              <input type="number" min={2} className="input" value={form.restreamDistinctThreshold} onChange={(e) => setForm({ ...form, restreamDistinctThreshold: Math.max(2, parseInt(e.target.value, 10) || 2) })} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" className="toggle" checked={form.restreamAutoBan} onChange={(e) => setForm({ ...form, restreamAutoBan: e.target.checked })} />
                <span className="text-xs">{t('security.restream.autoBan')}</span>
              </label>
            </div>
          </div>
          <div className="mt-4">
            <button className="btn-primary inline-flex items-center gap-1.5" disabled={update.isPending} onClick={() => update.mutate({ enabled: form.restreamDetectEnabled, windowMins: form.restreamWindowMins, threshold: form.restreamDistinctThreshold, autoBan: form.restreamAutoBan })}>
              <Save className="w-3.5 h-3.5" /> {update.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}
      <DataTable columns={cols} data={lines} keyExtractor={(r) => r.userId} isLoading={isLoading} emptyMessage={t('security.restream.empty')} />
    </div>
  );
}
