import { useState } from 'react';
import {
  Server, Plus, Wifi, WifiOff, Trash2, RefreshCw, MapPin,
  Users, Activity, Edit2, MoreVertical,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MiniSparkline } from '@/components/ui/MiniSparkline';
import { useServers, useCreateServer, useDeleteServer, useServerHealth, useUpdateServer } from '@/hooks/useServers';
import { cn } from '@/lib/utils';

const sparkSeed = (base: number) =>
  Array.from({ length: 12 }, (_, i) => Math.max(0, base + Math.sin(i * 0.7) * base * 0.4));

const roleLabelMap: Record<string, string> = {
  MAIN: 'Ana Sunucu',
  LOAD_BALANCER: 'Yük Dağıtıcı',
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

export function ServersPage() {
  const { data: servers = [], isLoading } = useServers();
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const updateServer = useUpdateServer();
  const healthCheck = useServerHealth();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [healthResults, setHealthResults] = useState<Record<string, { ms: number; ok: boolean } | null>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setForm(FORM_DEFAULT); setEditTarget(null); setShowAdd(true); };
  const openEdit = (s: (typeof servers)[0]) => {
    setForm({ name: s.name, ip: s.ip, port: String(s.port), maxClients: String(s.maxClients), role: s.role as 'MAIN' | 'LOAD_BALANCER', location: s.location ?? '' });
    setEditTarget(s.id);
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
    if (!confirm('Bu sunucuyu silmek istediğinizden emin misiniz?')) return;
    await deleteServer.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Sunucular</h1>
          <p className="text-sm text-muted mt-0.5">{servers.length} sunucu kayıtlı</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Sunucu Ekle
        </button>
      </div>

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
          <div className="text-slate-400 font-medium">Henüz sunucu yok</div>
          <div className="text-sm text-muted mt-1">İlk sunucuyu ekle</div>
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
                            <Edit2 className="w-3.5 h-3.5" /> Düzenle
                          </button>
                          <button onClick={() => { void handleHealth(srv.id); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 w-full text-left text-slate-300">
                            <Activity className="w-3.5 h-3.5" /> Sağlık Testi
                          </button>
                          <button onClick={() => { void handleDelete(srv.id); setOpenMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 w-full text-left text-danger">
                            <Trash2 className="w-3.5 h-3.5" /> Sil
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
                      <div className="text-[10px] text-muted">Bağlı</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-200 tabular-nums">{srv.maxClients}</div>
                      <div className="text-[10px] text-muted">Maks</div>
                    </div>
                    <div>
                      <div className={cn('text-lg font-bold tabular-nums', connPct > 80 ? 'text-danger' : connPct > 60 ? 'text-warning' : 'text-success')}>
                        {connPct}%
                      </div>
                      <div className="text-[10px] text-muted">Doluluk</div>
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
                      <span className="bg-surface-2 px-1.5 py-0.5 rounded text-[10px] ml-1">{roleLabelMap[srv.role] ?? srv.role}</span>
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
        title={editTarget ? 'Sunucuyu Düzenle' : 'Sunucu Ekle'}
        size="md"
      >
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Sunucu Adı</label>
              <input required className="input" value={form.name} onChange={f('name')} placeholder="Ana Sunucu TR-1" />
            </div>
            <div>
              <label className="label">IP Adresi</label>
              <input required className="input" value={form.ip} onChange={f('ip')} placeholder="192.168.1.10" />
            </div>
            <div>
              <label className="label">Port</label>
              <input required type="number" className="input" value={form.port} onChange={f('port')} />
            </div>
            <div>
              <label className="label">Maks Bağlantı</label>
              <input required type="number" className="input" value={form.maxClients} onChange={f('maxClients')} />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={form.role} onChange={f('role')}>
                <option value="MAIN">Ana Sunucu</option>
                <option value="LOAD_BALANCER">Yük Dağıtıcı</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Konum (opsiyonel)</label>
              <input className="input" value={form.location} onChange={f('location')} placeholder="İstanbul, TR" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>İptal</button>
            <button type="submit" className="btn btn-primary" disabled={createServer.isPending || updateServer.isPending}>
              {editTarget ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
