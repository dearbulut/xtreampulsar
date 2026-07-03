import { Radio, Wifi, Activity, Tv, UserX } from 'lucide-react';
import { useResellerLiveConnections, useKickLiveConnection } from '@/hooks/useResellerPanel';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useState } from 'react';

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk ${s}s`;
  return `${s}s`;
}

export function ResellerLivePage() {
  const { data: conns = [], isLoading, dataUpdatedAt } = useResellerLiveConnections();
  const kickConn = useKickLiveConnection();
  const [kickId, setKickId] = useState<string | null>(null);

  const totalBandwidthEst = conns.length * 4; // ~4 Mbps per stream estimate

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Canlı İzleme</h1>
        <p className="text-sm text-muted">Kullanıcılarınızın anlık bağlantıları (10 sn. güncellenir)</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted">Şu An İzleyen</div>
            <div className="text-2xl font-bold text-slate-100">{isLoading ? '…' : conns.length}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted">Aktif Stream</div>
            <div className="text-2xl font-bold text-slate-100">{isLoading ? '…' : new Set(conns.map((c) => c.stream.id)).size}</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Radio className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="text-xs text-muted">Tahmini Bandwidth</div>
            <div className="text-2xl font-bold text-slate-100">{isLoading ? '…' : `~${totalBandwidthEst}`}<span className="text-sm text-muted ml-1">Mbps</span></div>
          </div>
        </div>
      </div>

      {/* Connections table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-slate-200">Canlı Bağlantılar</span>
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted">
              Son güncelleme: {new Date(dataUpdatedAt).toLocaleTimeString('tr-TR')}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">Yükleniyor…</div>
        ) : conns.length === 0 ? (
          <div className="py-14 text-center">
            <Tv className="w-10 h-10 text-muted/20 mx-auto mb-3" />
            <p className="text-sm text-muted">Şu an aktif bağlantı yok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Kullanıcı</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">İzlenen Kanal</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">IP</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold">Süre</th>
                  <th className="px-4 py-3 text-xs text-muted font-semibold w-20" />
                </tr>
              </thead>
              <tbody>
                {conns.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-slate-200">{c.user.username}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm">{c.stream.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{c.ip}</td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDuration(c.durationSeconds)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setKickId(c.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                        title="Bağlantıyı Kes"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!kickId}
        title="Bağlantıyı Kes"
        message="Bu kullanıcının bağlantısı kesilecek. Emin misiniz?"
        confirmLabel="Kes"
        onConfirm={() => {
          if (kickId) kickConn.mutate(kickId, { onSuccess: () => setKickId(null) });
        }}
        onClose={() => setKickId(null)}
      />
    </div>
  );
}
