import { useState, useEffect } from 'react';
import {
  Server, Plus, Wifi, WifiOff, Trash2, RefreshCw, MapPin,
  Activity, Edit2, MoreVertical, Shield, Lock, Cpu, MemoryStick, Clock,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MiniSparkline } from '@/components/ui/MiniSparkline';
import { useServers, useCreateServer, useDeleteServer, useServerHealth, useUpdateServer, useServerMetrics } from '@/hooks/useServers';
import { useServerGuard, useUpdateServerGuard, useBlockedIps, useUnblockIp, type ServerGuard } from '@/hooks/useServerGuard';
import { useServerLoad } from '@/hooks/useUserActivity';
import { TagInput } from '@/components/ui/TagInput';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

const sparkSeed = (base: number) =>
  Array.from({ length: 12 }, (_, i) => Math.max(0, base + Math.sin(i * 0.7) * base * 0.4));

function GaugeBar({ value, label }: { value: number; label: string }) {
  const color = value > 90 ? 'bg-danger' : value > 70 ? 'bg-warning' : 'bg-success';
  const textColor = value > 90 ? 'text-danger' : value > 70 ? 'text-warning' : 'text-success';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted">{label}</span>
        <span className={cn('font-semibold tabular-nums', textColor)}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function ServerMetricsPanel({ serverId, isOnline }: { serverId: string; isOnline: boolean }) {
  const { data: metrics } = useServerMetrics(serverId, isOnline);
  if (!metrics || !isOnline) return null;

  return (
    <div className="border-t border-border/50 pt-3 mt-1 space-y-2">
      <GaugeBar value={metrics.cpu} label="CPU" />
      <GaugeBar value={metrics.memory} label="RAM" />
      <div className="flex justify-between text-[10px] mt-1">
        <span className="text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> Ping</span>
        <span className={cn('font-mono font-semibold', metrics.responseTime > 300 ? 'text-danger' : metrics.responseTime > 100 ? 'text-warning' : 'text-success')}>
          {metrics.responseTime}ms
        </span>
      </div>
    </div>
  );
}

const roleLabelKeys: Record<string, string> = {
  MAIN: 'servers.roleMain',
  LOAD_BALANCER: 'servers.roleLoadBalancer',
};

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex w-2 h-2 rounded-full',
        online ? 'bg-success' : 'bg-danger',
        online && 'animate-pulse',
      )}
    />
  );
}

interface FormState {
  name: string;
  ip: string;
  port: string;
  maxClients: string;
  role: 'MAIN' | 'LOAD_BALANCER';
  location: string;
}

const FORM_DEFAULT: FormState = {
  name: '',
  ip: '',
  port: '25461',
  maxClients: '1000',
  role: 'MAIN',
  location: '',
};

function ServerGuardPanel({ serverId }: { serverId: string }) {
  const { t } = useTranslation();
  const { data: guard, isLoading } = useServerGuard(serverId);
  const updateGuard = useUpdateServerGuard(serverId);
  const { data: blockedIps = [] } = useBlockedIps(serverId);
  const unblockIp = useUnblockIp(serverId);

  const [form, setForm] = useState<Partial<ServerGuard>>({});

  useEffect(() => {
    if (guard) setForm(guard);
  }, [guard]);

  if (isLoading) return <div className="p-6 text-center text-muted">{t('common.loading')}</div>;

  const g = { ...guard, ...form };
  const set = <K extends keyof ServerGuard>(k: K, v: ServerGuard[K]) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 space-y-5">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div>
          <div className="text-sm font-medium">Server Guard</div>
          <div className="text-xs text-muted">{t('servers.guardSubtitle')}</div>
        </div>
        <button type="button" onClick={() => set('enabled', !g.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${g.enabled ? 'bg-primary' : 'bg-border'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${g.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{t('servers.maxConnsPerIp')}</label>
          <input type="number" className="input" value={g.maxConnsPerIp ?? 200}
            onChange={e => set('maxConnsPerIp', parseInt(e.target.value, 10))} />
        </div>
        <div>
          <label className="label">{t('servers.blockDuration')}</label>
          <input type="number" className="input" value={g.blockDurationMinutes ?? 10}
            onChange={e => set('blockDurationMinutes', parseInt(e.target.value, 10))} />
        </div>
        <div>
          <label className="label">{t('servers.maxHitsNormalUser')}</label>
          <input type="number" className="input" value={g.maxHitsNormalUser ?? 50}
            onChange={e => set('maxHitsNormalUser', parseInt(e.target.value, 10))} />
        </div>
        <div>
          <label className="label">{t('servers.maxHitsRestreamer')}</label>
          <input type="number" className="input" value={g.maxHitsRestreamer ?? 500}
            onChange={e => set('maxHitsRestreamer', parseInt(e.target.value, 10))} />
        </div>
      </div>

      <div>
        <label className="label">{t('servers.sensitivePorts')}</label>
        <TagInput value={(g.sensitivePorts ?? []).map(String)}
          onChange={v => set('sensitivePorts', v.map(Number))} placeholder="22, 3306..." />
      </div>
      <div>
        <label className="label">{t('servers.openPorts')}</label>
        <TagInput value={(g.openPorts ?? []).map(String)}
          onChange={v => set('openPorts', v.map(Number))} placeholder="80, 443, 25461..." />
      </div>
      <div>
        <label className="label">{t('servers.whitelistIps')}</label>
        <TagInput value={g.whitelistIps ?? []}
          onChange={v => set('whitelistIps', v)} placeholder="192.168.1.1..." />
      </div>
      <div>
        <label className="label">{t('servers.whitelistUsernames')}</label>
        <TagInput value={g.whitelistUsernames ?? []}
          onChange={v => set('whitelistUsernames', v)} />
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={g.denyInvalidStreamIds ?? true}
            onChange={e => set('denyInvalidStreamIds', e.target.checked)} />
          <span className="text-sm">{t('servers.denyInvalidStreamIds')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-primary" checked={g.blockVpnProxy ?? false}
            onChange={e => set('blockVpnProxy', e.target.checked)} />
          <span className="text-sm">{t('servers.blockVpnProxy')}</span>
        </label>
      </div>

      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={updateGuard.isPending}
          onClick={() => void updateGuard.mutateAsync(form)}>
          {updateGuard.isPending ? t('servers.saving') : t('common.save')}
        </button>
      </div>

      {/* Blocked IPs table */}
      {blockedIps.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-danger" /> {t('servers.blockedIps', { count: blockedIps.length })}
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="table-th">IP</th>
                  <th className="table-th">{t('servers.reason')}</th>
                  <th className="table-th">{t('servers.duration')}</th>
                  <th className="table-th w-10"></th>
                </tr>
              </thead>
              <tbody>
                {blockedIps.map(b => (
                  <tr key={b.id} className="table-row">
                    <td className="table-td font-mono">{b.ip}</td>
                    <td className="table-td text-muted">{b.reason}</td>
                    <td className="table-td text-xs text-muted">{new Date(b.expiresAt).toLocaleString('tr-TR')}</td>
                    <td className="table-td">
                      <button onClick={() => void unblockIp.mutateAsync(b.ip)}
                        className="text-xs text-danger hover:underline">{t('servers.remove')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ServersPage() {
  const { t } = useTranslation();
  const { data: servers = [], isLoading } = useServers();
  const { data: loadStats = [] } = useServerLoad() as { data: Array<{ serverId: string; name: string; connections: number; maxClients: number; utilization: number; isOnline: boolean }> };
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const updateServer = useUpdateServer();
  const healthCheck = useServerHealth();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'details' | 'guard'>('details');
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [healthResults, setHealthResults] = useState<Record<string, { ms: number; ok: boolean } | null>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setEditTab('details'); setShowAdd(true); };
  const openEdit = (s: (typeof servers)[0]) => {
    setForm({ name: s.name, ip: s.ip, port: String(s.port), maxClients: String(s.maxClients), role: s.role as 'MAIN' | 'LOAD_BALANCER', location: s.location ?? '' });
    setEditTarget(s.id);
    setEditTab('details');
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      ip: form.ip,
      port: parseInt(form.port, 10),
      maxClients: parseInt(form.maxClients, 10),
      role: form.role,
      location: form.location || undefined,
    };
    if (editTarget) {
      await updateServer.mutateAsync({ id: editTarget, data: payload });
    } else {
      await createServer.mutateAsync(payload);
    }
    setShowAdd(false);
  };

  const handleHealth = async (id: string) => {
    setHealthResults((p) => ({ ...p, [id]: null }));
    try {
      const res = await healthCheck.mutateAsync(id);
      setHealthResults((p) => ({ ...p, [id]: { ms: res.data.data.responseTime, ok: res.data.data.isOnline } }));
    } catch {
      setHealthResults((p) => ({ ...p, [id]: { ms: -1, ok: false } }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('servers.deleteConfirm'))) return;
    await deleteServer.mutateAsync(id);
  };

  const totalConns = loadStats.reduce((s, x) => s + x.connections, 0);
  const totalMax = loadStats.reduce((s, x) => s + x.maxClients, 0);
  const overallUtil = totalMax > 0 ? Math.round((totalConns / totalMax) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.servers')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('servers.serverCount', { count: servers.length })}</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> {t('servers.addServer')}
        </button>
      </div>

      {/* Yük Dengesi Özet */}
      {loadStats.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-200">{t('servers.loadBalance')}</div>
            <div className={cn('text-xs font-semibold', overallUtil > 90 ? 'text-danger' : overallUtil > 70 ? 'text-warning' : 'text-success')}>
              {t('servers.totalUtilization', { pct: overallUtil })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {loadStats.map((s) => (
              <div key={s.serverId} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300 truncate">{s.name}</span>
                  <span className={cn('font-mono ml-1 flex-shrink-0', s.utilization > 90 ? 'text-danger' : s.utilization > 70 ? 'text-warning' : 'text-success')}>
                    {s.utilization}%
                  </span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', s.utilization > 90 ? 'bg-danger' : s.utilization > 70 ? 'bg-warning' : 'bg-success')}
                    style={{ width: `${Math.min(s.utilization, 100)}%` }}
                  />
                </div>
                <div className="text-muted mt-0.5">{s.connections}/{s.maxClients}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-48" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="card py-16 text-center">
          <Server className="w-12 h-12 text-muted mx-auto mb-3" />
          <div className="text-slate-400 font-medium">{t('servers.noServers')}</div>
          <div className="text-sm text-muted mt-1">{t('servers.addFirstServer')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((srv) => {
            const isOnline = srv.status === 'ONLINE';
            const connPct = srv.maxClients > 0 ? Math.round((srv.currentClients / srv.maxClients) * 100) : 0;
            const healthRes = healthResults[srv.id];

            return (
              <div key={srv.id} className="card group relative overflow-hidden">
                {/* Color accent line */}
                <div className={cn('absolute top-0 left-0 right-0 h-0.5', isOnline ? 'bg-success' : 'bg-danger')} />

                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isOnline ? 'bg-success/10' : 'bg-danger/10')}>
                        <Server className={cn('w-5 h-5', isOnline ? 'text-success' : 'text-danger')} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                          {srv.name}
                          <StatusDot online={isOnline} />
                        </div>
                        <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {srv.location ?? srv.ip}
                        </div>
                      </div>
                    </div>
                    {/* Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === srv.id ? null : srv.id)}
                        className="text-muted hover:text-slate-200 transition-colors p-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenu === srv.id && (
                        <div className="absolute right-0 top-6 bg-surface border border-border rounded-xl shadow-2xl z-10 py-1 w-36">
                          <button onClick={() => { openEdit(srv); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 w-full text-left text-slate-300">
                            <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                          </button>
                          <button onClick={() => { void handleHealth(srv.id); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 w-full text-left text-slate-300">
                            <Activity className="w-3.5 h-3.5" /> {t('servers.healthTest')}
                          </button>
                          <button onClick={() => { void handleDelete(srv.id); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 w-full text-left text-danger">
                            <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sparkline */}
                  <div className="h-10 mb-3 -mx-1">
                    <MiniSparkline
                      data={sparkSeed(srv.currentClients)}
                      color={isOnline ? '#22c55e' : '#ef4444'}
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-slate-200 tabular-nums">{srv.currentClients}</div>
                      <div className="text-[10px] text-muted">{t('servers.connected')}</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-200 tabular-nums">{srv.maxClients}</div>
                      <div className="text-[10px] text-muted">{t('servers.max')}</div>
                    </div>
                    <div>
                      <div className={cn('text-lg font-bold tabular-nums', connPct > 80 ? 'text-danger' : connPct > 60 ? 'text-warning' : 'text-success')}>
                        {connPct}%
                      </div>
                      <div className="text-[10px] text-muted">{t('servers.occupancy')}</div>
                    </div>
                  </div>

                  {/* Load bar */}
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', connPct > 80 ? 'bg-danger' : connPct > 60 ? 'bg-warning' : 'bg-success')}
                      style={{ width: `${connPct}%` }}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {isOnline ? <Wifi className="w-3 h-3 text-success" /> : <WifiOff className="w-3 h-3 text-danger" />}
                      <span>{srv.ip}:{srv.port}</span>
                      <span className="bg-surface-2 px-1.5 py-0.5 rounded text-[10px] ml-1">{roleLabelKeys[srv.role] ? t(roleLabelKeys[srv.role]) : srv.role}</span>
                    </div>
                    {healthRes !== undefined && (
                      <div className={cn('text-xs font-medium', healthRes?.ok ? 'text-success' : 'text-danger')}>
                        {healthRes === null ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : healthRes.ok ? (
                          `${healthRes.ms}ms`
                        ) : (
                          'Offline'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Real-time Metrics */}
                  <ServerMetricsPanel serverId={srv.id} isOnline={isOnline} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={editTarget ? t('servers.editServer') : t('servers.addServer')}
        size="md"
      >
        {/* Tabs — only shown when editing an existing server */}
        {editTarget && (
          <div className="flex border-b border-border">
            <button
              onClick={() => setEditTab('details')}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2', editTab === 'details' ? 'border-b-2 border-primary text-primary-light' : 'text-muted hover:text-fg')}
            >
              <Edit2 className="w-3.5 h-3.5" /> {t('servers.details')}
            </button>
            <button
              onClick={() => setEditTab('guard')}
              className={cn('px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2', editTab === 'guard' ? 'border-b-2 border-primary text-primary-light' : 'text-muted hover:text-fg')}
            >
              <Shield className="w-3.5 h-3.5" /> {t('servers.serverSecurity')}
            </button>
          </div>
        )}

        {/* Details form */}
        {(!editTarget || editTab === 'details') && (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">{t('servers.serverName')}</label>
                <input required className="input" value={form.name} onChange={f('name')} placeholder={t('servers.serverNamePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('servers.ipAddress')}</label>
                <input required className="input" value={form.ip} onChange={f('ip')} placeholder="192.168.1.10" />
              </div>
              <div>
                <label className="label">Port</label>
                <input required type="number" className="input" value={form.port} onChange={f('port')} />
              </div>
              <div>
                <label className="label">{t('servers.maxConnections')}</label>
                <input required type="number" className="input" value={form.maxClients} onChange={f('maxClients')} />
              </div>
              <div>
                <label className="label">{t('servers.role')}</label>
                <select className="input" value={form.role} onChange={f('role')}>
                  <option value="MAIN">{t('servers.roleMain')}</option>
                  <option value="LOAD_BALANCER">{t('servers.roleLoadBalancer')}</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">{t('servers.locationOptional')}</label>
                <input className="input" value={form.location} onChange={f('location')} placeholder="İstanbul, TR" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={createServer.isPending || updateServer.isPending}>
                {editTarget ? t('common.update') : t('common.add')}
              </button>
            </div>
          </form>
        )}

        {/* Guard panel */}
        {editTarget && editTab === 'guard' && (
          <ServerGuardPanel serverId={editTarget} />
        )}
      </Modal>
    </div>
  );
}
