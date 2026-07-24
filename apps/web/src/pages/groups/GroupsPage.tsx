import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Plus, Pencil, Trash2, ShieldCheck, Store, Ban, Users, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  useGroups, usePermissionCatalog, useCreateGroup, useUpdateGroup, useDeleteGroup,
  type AdminGroup, type GroupInput,
} from '@/hooks/useGroups';

interface FormState {
  id?: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isReseller: boolean;
  isBanned: boolean;
  permissions: Set<string>;
  isSystem: boolean;
}

const EMPTY: FormState = {
  name: '', description: '', isAdmin: false, isReseller: false, isBanned: false,
  permissions: new Set(), isSystem: false,
};

export function GroupsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en';
  const { data: groups = [], isLoading } = useGroups();
  const { data: catalog = [] } = usePermissionCatalog();
  const createMut = useCreateGroup();
  const updateMut = useUpdateGroup();
  const deleteMut = useDeleteGroup();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<AdminGroup | null>(null);

  const totalPerms = useMemo(
    () => catalog.reduce((n, c) => n + c.permissions.length, 0),
    [catalog],
  );

  function openCreate() { setForm({ ...EMPTY, permissions: new Set() }); setModalOpen(true); }
  function openEdit(g: AdminGroup) {
    setForm({
      id: g.id, name: g.name, description: g.description ?? '',
      isAdmin: g.isAdmin, isReseller: g.isReseller, isBanned: g.isBanned,
      permissions: new Set(g.permissions), isSystem: g.isSystem,
    });
    setModalOpen(true);
  }

  function togglePerm(key: string) {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(key)) next.delete(key); else next.add(key);
      return { ...f, permissions: next };
    });
  }
  function toggleCategory(keys: string[], allOn: boolean) {
    setForm((f) => {
      const next = new Set(f.permissions);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return { ...f, permissions: next };
    });
  }

  function save() {
    const body: GroupInput = {
      name: form.name, description: form.description || null,
      isAdmin: form.isAdmin, isReseller: form.isReseller, isBanned: form.isBanned,
      permissions: [...form.permissions],
    };
    if (form.id) updateMut.mutate({ id: form.id, body }, { onSuccess: () => setModalOpen(false) });
    else createMut.mutate(body, { onSuccess: () => setModalOpen(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> {t('groups.title')}
          </h1>
          <p className="text-sm text-muted mt-1">{t('groups.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> {t('groups.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-muted text-sm">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div key={g.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {g.name}
                    {g.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted">{t('groups.system')}</span>}
                  </div>
                  {g.description && <div className="text-xs text-muted mt-0.5">{g.description}</div>}
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-fg transition-colors" title={t('common.edit')} onClick={() => openEdit(g)}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  {!g.isSystem && (
                    <button className="p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-danger transition-colors" title={t('common.delete')} onClick={() => setDeleteTarget(g)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.isAdmin && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary"><ShieldCheck className="w-3 h-3" /> {t('groups.isAdmin')}</span>}
                {g.isReseller && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-muted"><Store className="w-3 h-3" /> {t('groups.isReseller')}</span>}
                {g.isBanned && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-danger/15 text-danger"><Ban className="w-3 h-3" /> {t('groups.isBanned')}</span>}
              </div>
              <div className="flex items-center justify-between text-xs text-muted border-t border-border pt-2">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g._count?.users ?? 0} {t('groups.members')}</span>
                <span>{g.isAdmin ? t('groups.allPerms') : `${g.permissions.length}/${totalPerms} ${t('groups.perms')}`}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={form.id ? t('groups.editTitle', { name: form.name }) : t('groups.new')} size="2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t('groups.name')}</label>
              <input className="input" value={form.name} disabled={form.isSystem}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t('groups.description')}</label>
              <input className="input" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-2/40 p-3">
            <div className="label mb-2">{t('groups.flags')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={form.isAdmin} disabled={form.isSystem}
                  onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))} />
                <ShieldCheck className="w-4 h-4 text-primary" /> {t('groups.isAdmin')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={form.isReseller} disabled={form.isSystem}
                  onChange={(e) => setForm((f) => ({ ...f, isReseller: e.target.checked }))} />
                <Store className="w-4 h-4" /> {t('groups.isReseller')}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-primary" checked={form.isBanned} disabled={form.isSystem}
                  onChange={(e) => setForm((f) => ({ ...f, isBanned: e.target.checked }))} />
                <Ban className="w-4 h-4 text-danger" /> {t('groups.isBanned')}
              </label>
            </div>
            {form.isAdmin && <p className="text-[11px] text-muted mt-2">{t('groups.adminHint')}</p>}
          </div>

          <div className={form.isAdmin ? 'opacity-40 pointer-events-none' : ''}>
            <div className="label mb-2">{t('groups.matrix')}</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {catalog.map((cat) => {
                const keys = cat.permissions.map((p) => p.key);
                const allOn = keys.every((k) => form.permissions.has(k));
                return (
                  <div key={cat.key} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{lang === 'tr' ? cat.labelTr : cat.labelEn}</span>
                      <button type="button" className="text-[11px] text-primary hover:underline"
                        onClick={() => toggleCategory(keys, allOn)}>
                        {allOn ? t('groups.clearAll') : t('groups.selectAll')}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {cat.permissions.map((p) => (
                        <label key={p.key} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" className="accent-primary" checked={form.permissions.has(p.key)}
                            onChange={() => togglePerm(p.key)} />
                          {lang === 'tr' ? p.labelTr : p.labelEn}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={save}
              disabled={!form.name.trim() || createMut.isPending || updateMut.isPending}>
              <Check className="w-4 h-4" /> {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('groups.deleteTitle')} size="sm">
        <p className="text-sm text-muted">{t('groups.deleteConfirm', { name: deleteTarget?.name })}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
          <button className="btn btn-danger" disabled={deleteMut.isPending}
            onClick={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }}>
            <Trash2 className="w-4 h-4" /> {t('common.delete')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
