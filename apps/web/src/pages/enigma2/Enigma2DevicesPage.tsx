import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Search, Satellite } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useEnigma2Devices, useCreateEnigma2Device, useUpdateEnigma2Device, useDeleteEnigma2Device,
} from '@/hooks/useEnigma2Devices';
import { useUsers } from '@/hooks/useUsers';
import type { Enigma2Device } from '@/types';
import { cn } from '@/lib/utils';

const OE_VERSIONS = ['OE2.0', 'OE1.6'];

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function Enigma2DevicesPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editDevice, setEditDevice] = useState<Enigma2Device | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [macInput, setMacInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [boxInput, setBoxInput] = useState('');
  const [oeInput, setOeInput] = useState('OE2.0');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { data: devices = [], isLoading } = useEnigma2Devices(debouncedSearch || undefined);
  const { data: usersData } = useUsers({ search: userSearch, limit: 20 });
  const users = usersData?.items ?? [];

  const createDevice = useCreateEnigma2Device();
  const updateDevice = useUpdateEnigma2Device();
  const deleteDevice = useDeleteEnigma2Device();

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _e2Timer?: ReturnType<typeof setTimeout> })._e2Timer);
    (window as unknown as { _e2Timer?: ReturnType<typeof setTimeout> })._e2Timer = setTimeout(() => setDebouncedSearch(v), 300);
  };

  const resetForm = () => { setMacInput(''); setNameInput(''); setBoxInput(''); setOeInput('OE2.0'); setSelectedUserId(''); setUserSearch(''); };

  const openEdit = (d: Enigma2Device) => {
    setEditDevice(d);
    setNameInput(d.deviceName ?? '');
    setBoxInput(d.boxType ?? '');
    setOeInput(d.oeVersion ?? 'OE2.0');
    setSelectedUserId(d.userId ?? '');
    setUserSearch(d.user?.username ?? '');
  };

  const handleCreate = () => {
    if (!macInput.trim()) return;
    createDevice.mutate(
      { mac: macInput.trim(), userId: selectedUserId || undefined, deviceName: nameInput || undefined, boxType: boxInput || undefined, oeVersion: oeInput },
      { onSuccess: () => { setShowCreate(false); resetForm(); } },
    );
  };

  const handleUpdate = () => {
    if (!editDevice) return;
    updateDevice.mutate(
      { id: editDevice.id, userId: selectedUserId || null, deviceName: nameInput || null, boxType: boxInput || null, oeVersion: oeInput },
      { onSuccess: () => { setEditDevice(null); resetForm(); } },
    );
  };

  const MetaFields = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t('enigma2.deviceName')}</label>
          <input className="input" placeholder="VU+ Zero" value={nameInput} onChange={(e) => setNameInput(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('enigma2.oeVersion')}</label>
          <select className="input" value={oeInput} onChange={(e) => setOeInput(e.target.value)}>
            {OE_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">{t('enigma2.boxType')}</label>
        <input className="input" placeholder="Dreambox One / GigaBlue…" value={boxInput} onChange={(e) => setBoxInput(e.target.value)} />
      </div>
    </>
  );

  const UserSelector = (
    <div>
      <label className="label">{t('enigma2.user')} <span className="text-muted text-xs">{t('enigma2.optional')}</span></label>
      <input className="input mb-2" placeholder={t('enigma2.searchUsername')} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
      <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} size={4}>
        <option value="">{t('enigma2.unassignedOption')}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('enigma2.title')}
        description={t('enigma2.description')}
        actions={
          <button onClick={() => { setShowCreate(true); resetForm(); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('enigma2.addDevice')}
          </button>
        }
      />

      <div className="card p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input className="input pl-9 h-9" placeholder={t('enigma2.searchMac')} value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="text-center text-muted py-12">{t('common.loading')}</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Satellite className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t('enigma2.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('enigma2.macAddress')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('enigma2.device')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('enigma2.user')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold">{t('enigma2.lastSeen')}</th>
                <th className="px-4 py-3 text-xs text-muted font-semibold w-28">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{d.mac}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-200">{d.deviceName || <span className="text-muted italic">—</span>}</div>
                    <div className="text-[11px] text-muted">{[d.boxType, d.oeVersion].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="px-4 py-3">
                    {d.user ? (
                      <div>
                        <span className="font-mono text-sm text-slate-200">{d.user.username}</span>
                        <span className={cn('ml-2 text-xs', d.user.status === 'ACTIVE' ? 'text-emerald-400' : 'text-muted')}>{d.user.status}</span>
                      </div>
                    ) : (
                      <span className="text-muted text-xs italic">{t('enigma2.unassigned')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(d.lastSeen)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-surface-2 text-muted hover:text-blue-400 transition-colors" title={t('common.edit')}>
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('enigma2.addDevice')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{t('enigma2.macAddressRequired')}</label>
            <input className="input font-mono uppercase" placeholder="AA:BB:CC:DD:EE:FF" value={macInput} onChange={(e) => setMacInput(e.target.value)} />
          </div>
          {MetaFields}
          {UserSelector}
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setShowCreate(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={handleCreate} disabled={createDevice.isPending || !macInput.trim()} className="btn-primary">
              {createDevice.isPending ? t('enigma2.adding') : t('common.add')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editDevice} onClose={() => setEditDevice(null)} title={t('enigma2.editTitle', { mac: editDevice?.mac ?? '' })} size="sm">
        <div className="space-y-4">
          {MetaFields}
          {UserSelector}
          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button onClick={() => setEditDevice(null)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={handleUpdate} disabled={updateDevice.isPending} className="btn-primary">
              {updateDevice.isPending ? t('enigma2.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={t('enigma2.deleteDevice')}
        message={t('enigma2.deleteConfirm')}
        confirmLabel={t('common.delete')}
        onConfirm={() => { if (deleteId) deleteDevice.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
