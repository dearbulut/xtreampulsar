import { Users, Wifi, CreditCard, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useResellerStats, useResellerExpiring } from '@/hooks/useResellerPanel';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function StatBadge({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-xl font-bold text-slate-100">{value}</div>
      </div>
    </div>
  );
}

export function ResellerDashboardPage() {
  const resellerUser = useAuthStore((s) => s.resellerUser);
  const { data: stats, isLoading: statsLoading } = useResellerStats();
  const { data: expiring, isLoading: expiringLoading } = useResellerExpiring();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Hoş geldiniz, {resellerUser?.username}</h1>
        <p className="text-sm text-muted">Bayi kontrol paneliniz</p>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatBadge label="Kreditiniz" value={resellerUser?.credits ?? 0} icon={CreditCard} />
          <StatBadge label="Online Kullanıcı" value={stats?.onlineConnections ?? 0} icon={Wifi} />
          <StatBadge label="Aktif Hat" value={stats?.activeUsers ?? 0} icon={Users} />
          <StatBadge label="Toplam Kullanıcı" value={stats?.totalUsers ?? 0} icon={Users} />
        </div>
      )}

      {/* Expiring users */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-slate-200">7 Gün İçinde Süresi Dolacaklar</h2>
        </div>

        {expiringLoading ? (
          <div className="flex justify-center py-4"><LoadingSpinner /></div>
        ) : !expiring || expiring.length === 0 ? (
          <div className="text-center text-muted text-sm py-6">Yakın tarihte süresi dolacak kullanıcı yok</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs font-medium text-muted">Kullanıcı</th>
                  <th className="text-left py-2 text-xs font-medium text-muted">Bitiş</th>
                  <th className="text-left py-2 text-xs font-medium text-muted">Bağlantı</th>
                  <th className="text-left py-2 text-xs font-medium text-muted">Durum</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((u) => {
                  const daysLeft = Math.ceil(
                    (new Date(u.expiresAt).getTime() - Date.now()) / 86_400_000,
                  );
                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-surface-2/50">
                      <td className="py-2.5 font-mono text-slate-300">{u.username}</td>
                      <td className="py-2.5 text-muted">
                        {new Date(u.expiresAt).toLocaleDateString('tr-TR')}
                        <span className={`ml-2 text-xs ${daysLeft <= 2 ? 'text-red-400' : 'text-amber-400'}`}>
                          ({daysLeft}g)
                        </span>
                      </td>
                      <td className="py-2.5 text-muted">{u.maxConnections}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
