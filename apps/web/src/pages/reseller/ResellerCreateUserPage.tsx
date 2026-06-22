import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { useResellerCreateUser, useResellerPackages } from '@/hooks/useResellerPanel';
import { useAuthStore } from '@/store/auth.store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function ResellerCreateUserPage() {
  const navigate = useNavigate();
  const resellerUser = useAuthStore((s) => s.resellerUser);
  const { data: packages, isLoading: pkgLoading } = useResellerPackages();
  const createUser = useResellerCreateUser();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPkg, setSelectedPkg] = useState('');
  const [maxConn, setMaxConn] = useState(1);
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const pkg = packages?.find((p) => p.id === selectedPkg);
  const creditCost = pkg?.creditCost ?? 1;
  const insufficientCredits = (resellerUser?.credits ?? 0) < creditCost;

  const handlePackageChange = (pkgId: string) => {
    setSelectedPkg(pkgId);
    const p = packages?.find((x) => x.id === pkgId);
    if (p) {
      setMaxConn(p.maxConnections);
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + p.durationDays);
      setExpiresAt(expDate.toISOString().slice(0, 10));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (insufficientCredits) return;
    await createUser.mutateAsync({
      username,
      password,
      maxConnections: maxConn,
      expiresAt: new Date(expiresAt).toISOString(),
      ...(selectedPkg ? { packageId: selectedPkg } : {}),
    });
    void navigate({ to: '/reseller/users' });
  };

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Yeni Kullanıcı Oluştur</h1>
        <p className="text-sm text-muted">Mevcut kredit: <span className="text-slate-300 font-medium">{resellerUser?.credits ?? 0}</span></p>
      </div>

      {pkgLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="card p-6 space-y-4">
          {/* Package selector */}
          {packages && packages.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Paket (opsiyonel)</label>
              <select
                value={selectedPkg}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="input w-full"
              >
                <option value="">Paket seçme (manuel gir)</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.durationDays} gün, {p.maxConnections} bağlantı ({p.creditCost} kredi)
                  </option>
                ))}
              </select>
              {pkg && (
                <p className="text-xs text-muted">
                  Bu paket <span className="text-primary font-medium">{pkg.creditCost}</span> kredi düşecek
                </p>
              )}
            </div>
          )}

          {/* Insufficient credits warning */}
          {insufficientCredits && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Yetersiz kredi. Bu işlem için {creditCost} kredi gerekli, bakiyeniz {resellerUser?.credits ?? 0}.
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullanici_adi"
              className="input w-full"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 4 karakter"
              className="input w-full"
              minLength={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Max Bağlantı</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxConn}
                onChange={(e) => setMaxConn(+e.target.value)}
                className="input w-full"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted">Bitiş Tarihi</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input w-full"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => void navigate({ to: '/reseller/users' })}
              className="btn-ghost flex-1"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={createUser.isPending || insufficientCredits || !username || !password}
              className="btn-primary flex-1"
            >
              {createUser.isPending ? 'Oluşturuluyor…' : 'Kullanıcı Oluştur'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
