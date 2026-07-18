import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Search, Tv } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useMagDevices,
  useCreateMagDevice,
  useUpdateMagDevice,
  useDeleteMagDevice,
} from '@/hooks/useMagDevices';
import { useUsers } from '@/hooks/useUsers';
import type { MagDevice } from '@/types';
import { cn } from '@/lib/utils';

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function MagDevicesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editDevice, setEditDevice] = useState<MagDevice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [macInput, setMacInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: devices = [], isLoading } = useMagDevices(debouncedSearch || undefined);
  const { data: usersData } = useUsers({ search: userSearch, limit: 20 });
  const users = usersData?.items ?? [];

  const createDevice = useCreateMagDevice();
  const updateDevice = useUpdateMagDevice();
  const deleteDevice = useDeleteMagDevice();

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _magSearchTimer?: ReturnType<typeof setTimeout> })._magSearchTimer);
    (window as unknown as { _magSearchTimer?: ReturnType<typeof setTimeout> })._magSearchTimer = setTimeout(() => setDebouncedSearch(v), 300);
  };

  const openEdit = (d: MagDevice) => {
    setEditDevice(d);
    setSelectedUserId(d.userId ?? '');
    setUserSearch(d.user?.username ?? '');
  };

  const handleCreate = () => {
    if (!macInput.trim()) return;
    createDevice.mutate(
      { mac: macInput.trim(), userId: selectedUserId || undefined },
      { onSuccess: () => { setShowCreate(false); setMacInput(''); setSelectedUserId(''); setUserSearch(''); } },
    );
  };

  const handleUpdate = () => {
    if (!editDevice) return;
    updateDevice.mutate(
      { id: editDevice.id, userId: selectedUserId || null },
      { onSuccess: () => { setEditDevice(null); setSelectedUserId(''); setUserSearch(''); } },
    );
  };

  const UserSelector = (
    <div>
      <label className="label">{t('mag.user')} <span className="text-muted text-xs">{t('mag.optional')}</span></label>
      <input
        className="input mb-2"
        placeholder={t('mag.searchUsername')}
        value={userSearch}
        onChange={(e) => setUserSearch(e.target.value)}
      />
      <select
        className="input"
        value={selectedUserId}
        onChange={(e) => setSelectedUserId(e.target.value)}
        size={4}
      >
        <option value="">{t('mag.unassignedOption')}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.username}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('mag.title')}
        description={t('mag.description')}
        actions={
          <button onClick={() => { setShowCreate(true); setMacInput(''); setSelectedUserId(''); setUserSearch(''); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('mag.addDevice')}
          </button>
        }
      />

      {/* Search */}
      <div className="card p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input className="input pl-9 h-9" placeholder={t('mag.searchMac')} value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="text-center text-muted py-12">{t('common.loading')}</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Tv className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t('mag.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('mag.macAddress')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('mag.user')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('mag.lastSeen')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold w-28">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{d.mac}</td>
                  <td className="px-4 py-3">
                    {d.user ? (
                      <div>
                        <span className="font-mono text-sm text-slate-200">{d.user.username}</span>
                        <span className={cn('ml-2 text-xs', d.user.status === 'ACTIVE' ? 'text-emerald-400' : 'text-muted')}>{d.user.status}</span>
                      </div>
                    ) : (
                      <span className="text-muted text-xs italic">{t('mag.unassigned')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(d.lastSeen)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-blue-400 transition-colors" title={t('mag.changeUser')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(d.id)} className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-danger transition-colors" title={t('common.delete')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('mag.addDevice')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('mag.macAddressRequired')}</label>
            <input className="input font-mono uppercase" placeholder="AA:BB:CC:DD:EE:FF" value={macInput} onChange={(e) => setMacInput(e.target.value)} />
          </div>
          {UserSelector}
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={handleCreate} disabled={createDevice.isPending || !macInput.trim()} className="btn-primary">
              {createDevice.isPending ? t('mag.adding') : t('common.add')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editDevice} onClose={() => setEditDevice(null)} title={t('mag.changeUserTitle', { mac: editDevice?.mac ?? '' })} size="sm">
        <div className="space-y-4">
          {UserSelector}
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setEditDevice(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={handleUpdate} disabled={updateDevice.isPending} className="btn-primary">
              {updateDevice.isPending ? t('mag.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteId}
        title={t('mag.deleteDevice')}
        message={t('mag.deleteConfirm')}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          if (deleteId) deleteDevice.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
