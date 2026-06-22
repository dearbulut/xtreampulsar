import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { UserPlus, Wifi, ShieldBan, CalendarPlus } from 'lucide-react';
import {
  useResellerUsers,
  useResellerBanUser,
  useResellerKickUser,
  useResellerExtendUser,
} from '@/hooks/useResellerPanel';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function ResellerUsersPage() {
  const [page, setPage] = useState(1);
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});

  const { data, isLoading } = useResellerUsers(page, 20);
  const ban = useResellerBanUser();
  const kick = useResellerKickUser();
  const extend = useResellerExtendUser();

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Kullanıcılarım</h1>
          <p className="text-sm text-muted">{data?.total ?? 0} kullanıcı</p>
        </div>
        <Link
          to="/reseller/users/create"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Yeni Kullanıcı
        </Link>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : !data?.items.length ? (
          <div className="text-center text-muted py-12">Henüz kullanıcı yok</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Kullanıcı</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Durum</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Bitiş</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">Bağlantı</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-surface-2/50">
                  <td className="px-4 py-3 font-mono text-slate-300">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      u.status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : u.status === 'BANNED'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-slate-500/15 text-slate-400'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(u.expiresAt).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="px-4 py-3 text-muted">{u.maxConnections}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Extend */}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={extendDays[u.id] ?? 30}
                          onChange={(e) => setExtendDays((prev) => ({ ...prev, [u.id]: +e.target.value }))}
                          className="input w-14 text-xs py-1 px-2"
                        />
                        <button
                          onClick={() => extend.mutate({ id: u.id, days: extendDays[u.id] ?? 30 })}
                          disabled={extend.isPending}
                          className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="Süre uzat"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Kick */}
                      <button
                        onClick={() => kick.mutate(u.id)}
                        disabled={kick.isPending && kick.variables === u.id}
                        className="p-1.5 rounded text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Bağlantıyı kes"
                      >
                        <Wifi className="w-3.5 h-3.5" />
                      </button>
                      {/* Ban */}
                      <button
                        onClick={() => ban.mutate(u.id)}
                        disabled={ban.isPending && ban.variables === u.id}
                        className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Banla"
                      >
                        <ShieldBan className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost text-sm">
            ‹ Önceki
          </button>
          <span className="text-sm text-muted self-center">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost text-sm">
            Sonraki ›
          </button>
        </div>
      )}
    </div>
  );
}
