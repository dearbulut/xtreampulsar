import { useState } from 'react';
import { Shield, Ban, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useBlockedIPs, useBruteForceLogs, useUnblockIP, useBlockIP, type BlockedIP, type BruteForceLog } from '@/hooks/useSecurity';
import { cn } from '@/lib/utils';

const SECURITY_TABS: TabItem[] = [
  { id: 'blocks', label: 'Aktif Bloklar' },
  { id: 'bruteforce', label: 'Brute Force Logu' },
];

export function SecurityPage() {
  const [activeTab, setActiveTab] = useState('blocks');
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ ip: '', reason: '', durationMinutes: '0' });

  const { data: blocks = [], isLoading: bLoading } = useBlockedIPs();
  const { data: bfLogs = [], isLoading: bfLoading } = useBruteForceLogs();
  const unblock = useUnblockIP();
  const blockIP = useBlockIP();

  const handleUnblock = async (ip: string) => {
    if (!confirm(`${ip} engelini kaldır?`)) return;
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
      header: 'IP Adresi',
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
    { key: 'reason', header: 'Sebep', render: (row) => <span className="text-sm text-slate-400">{row.reason}</span> },
    {
      key: 'blockedAt',
      header: 'Engellenme',
      render: (row) =>
        new Date(row.blockedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'expiresAt',
      header: 'Bitiş',
      render: (row) =>
        row.expiresAt
          ? new Date(row.expiresAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : <span className="text-xs text-muted">Süresiz</span>,
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
          <RefreshCw className="w-3 h-3 mr-1" /> Kaldır
        </button>
      ),
    },
  ];

  const bfColumns: Column<BruteForceLog>[] = [
    {
      key: 'ip',
      header: 'IP Adresi',
      render: (row) => <span className="font-mono text-sm text-slate-200">{row.ip}</span>,
    },
    {
      key: 'attempts',
      header: 'Deneme',
      render: (row) => (
        <span className={cn('text-sm font-semibold', row.attempts > 20 ? 'text-danger' : row.attempts > 10 ? 'text-warning' : 'text-slate-400')}>
          {row.attempts}
        </span>
      ),
    },
    {
      key: 'lastAttempt',
      header: 'Son Deneme',
      render: (row) =>
        new Date(row.lastAttempt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    },
    {
      key: 'blocked',
      header: 'Durum',
      render: (row) => (
        <span className={cn('badge', row.blocked ? 'badge-danger' : 'badge-warning')}>
          {row.blocked ? 'Engellendi' : 'İzleniyor'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Güvenlik</h1>
          <p className="text-sm text-muted mt-0.5">IP blokları ve saldırı tespit sistemi</p>
        </div>
        <button onClick={() => setShowBlock(true)} className="btn btn-danger">
          <Ban className="w-4 h-4" /> IP Engelle
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aktif Blok', value: blocks.length, icon: Shield, color: 'text-danger', bg: 'bg-danger/10' },
          { label: 'Brute Force', value: bfLogs.filter((l) => l.blocked).length, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'İzlenen IP', value: bfLogs.filter((l) => !l.blocked).length, icon: Globe, color: 'text-primary-light', bg: 'bg-primary/10' },
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
          emptyMessage="Aktif blok yok"
        />
      )}

      {activeTab === 'bruteforce' && (
        <DataTable
          columns={bfColumns}
          data={bfLogs}
          isLoading={bfLoading}
          emptyMessage="Brute force girişimi tespit edilmedi"
        />
      )}

      <Modal open={showBlock} onClose={() => setShowBlock(false)} title="IP Engelle" size="sm">
        <form onSubmit={(e) => { void handleBlock(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">IP Adresi</label>
            <input
              required
              className="input font-mono"
              value={blockForm.ip}
              onChange={(e) => setBlockForm((p) => ({ ...p, ip: e.target.value }))}
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="label">Sebep</label>
            <input
              required
              className="input"
              value={blockForm.reason}
              onChange={(e) => setBlockForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="Manuel engelleme"
            />
          </div>
          <div>
            <label className="label">Süre (dakika, 0 = süresiz)</label>
            <input
              type="number"
              className="input"
              value={blockForm.durationMinutes}
              onChange={(e) => setBlockForm((p) => ({ ...p, durationMinutes: e.target.value }))}
              min="0"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowBlock(false)}>İptal</button>
            <button type="submit" className="btn btn-danger" disabled={blockIP.isPending}>Engelle</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
