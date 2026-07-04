'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { controlApi } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { Plus, Pause, Play, Trash2 } from 'lucide-react';

interface License {
  id: string;
  key: string;
  plan: string;
  status: string;
  maxUsers: number;
  maxServers: number;
  serverIp?: string;
  serverDomain?: string;
  expiresAt?: string;
  lastVerifiedAt?: string;
  customer: { name: string; email: string };
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  TRIAL: 'bg-blue-500/10 text-blue-400',
  SUSPENDED: 'bg-red-500/10 text-red-400',
  EXPIRED: 'bg-gray-700 text-gray-400',
};

export default function LicensesPage() {
  const router = useRouter();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    controlApi.licenses.list()
      .then((res) => {
        const d = res.data.data ?? res.data;
        setLicenses(d.data);
        setTotal(d.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    load();
  }, [router]);

  async function handleSuspend(id: string) {
    await controlApi.licenses.suspend(id);
    load();
  }

  async function handleActivate(id: string) {
    await controlApi.licenses.activate(id);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu lisansı silmek istediğinizden emin misiniz?')) return;
    await controlApi.licenses.delete(id);
    load();
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-[240px] flex flex-col">
        <Header title="Lisanslar" />
        <main className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs text-gray-500">{total} lisans</span>
            <button className="ml-auto flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm px-3 py-2 rounded-lg transition-colors">
              <Plus size={14} /> Yeni Lisans
            </button>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Anahtar</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Müşteri</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Plan</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Sunucu</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Bitiş</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Yükleniyor...</td></tr>
                ) : licenses.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Lisans bulunamadı</td></tr>
                ) : licenses.map((l) => (
                  <tr key={l.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{l.key}</td>
                    <td className="px-4 py-3">
                      <p className="text-white">{l.customer.name}</p>
                      <p className="text-xs text-gray-500">{l.customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{l.plan}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.serverDomain ?? l.serverIp ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('tr-TR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status] ?? 'bg-gray-700 text-gray-400'}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {l.status === 'SUSPENDED' ? (
                          <button onClick={() => handleActivate(l.id)} className="p-1 text-gray-500 hover:text-green-400 transition-colors" title="Aktifleştir">
                            <Play size={14} />
                          </button>
                        ) : (
                          <button onClick={() => handleSuspend(l.id)} className="p-1 text-gray-500 hover:text-yellow-400 transition-colors" title="Askıya Al">
                            <Pause size={14} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(l.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Sil">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
