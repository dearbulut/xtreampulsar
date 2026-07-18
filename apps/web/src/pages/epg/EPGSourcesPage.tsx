import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, RefreshCw, CheckCircle, XCircle, Radio } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import {
  useEPGSources,
  useCreateEPGSource,
  useDeleteEPGSource,
  useParseEPGSource,
  useParseAllEPGSources,
  useMassAssignEPG,
} from '@/hooks/useEPG';
import type { EPGSource } from '@/types';
import { cn, dateLocale } from '@/lib/utils';
import { Link } from '@tanstack/react-router';

export function EPGSourcesPage() {
  const { t } = useTranslation();
  const { data: sources = [], isLoading } = useEPGSources();
  const createSource = useCreateEPGSource();
  const deleteSource = useDeleteEPGSource();
  const parseSource = useParseEPGSource();
  const parseAll = useParseAllEPGSources();
  const massAssign = useMassAssignEPG();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', xmltvUrl: '', daysToKeep: '7' });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSource.mutateAsync({
      name: form.name,
      xmltvUrl: form.xmltvUrl,
      daysToKeep: parseInt(form.daysToKeep, 10),
      isActive: true,
    });
    setShowAdd(false);
    setForm({ name: '', xmltvUrl: '', daysToKeep: '7' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('epg.sources.confirmDelete'))) return;
    await deleteSource.mutateAsync(id);
  };

  const handleMassAssign = async (id: string) => {
    await massAssign.mutateAsync({ epgSourceId: id, minSimilarity: 0.6 });
  };

  const columns: Column<EPGSource>[] = [
    {
      key: 'name',
      header: t('epg.sources.colSource'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <div className="font-medium text-slate-200">{row.name}</div>
            <div className="text-xs text-muted truncate max-w-[200px]">{row.xmltvUrl}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <span className={cn('badge', row.isActive ? 'badge-success' : 'badge-gray')}>
          {row.isActive ? t('common.active') : t('common.inactive')}
        </span>
      ),
    },
    {
      key: 'daysToKeep',
      header: t('epg.sources.colRetention'),
      render: (row) => <span className="text-sm">{t('epg.sources.daysValue', { n: row.daysToKeep ?? 7 })}</span>,
    },
    {
      key: 'updatedAt',
      header: t('epg.sources.colUpdatedAt'),
      render: (row) =>
        row.updatedAt
          ? new Date(row.updatedAt).toLocaleDateString(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '-',
    },
    {
      key: 'actions',
      header: '',
      className: 'w-px',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => void parseSource.mutateAsync(row.id)}
            disabled={parseSource.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title="Force Reload"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', parseSource.isPending && 'animate-spin')} />
          </button>
          <button
            onClick={() => void handleMassAssign(row.id)}
            disabled={massAssign.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title={t('epg.sources.massAssign')}
          >
            <CheckCircle className="w-3.5 h-3.5 text-success" />
          </button>
          <button
            onClick={() => void handleDelete(row.id)}
            disabled={deleteSource.isPending}
            className="btn btn-ghost py-1 px-2 text-xs"
            title={t('common.delete')}
          >
            <XCircle className="w-3.5 h-3.5 text-danger" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{t('nav.epgSources')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('epg.sources.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/epg/mass-assign" className="btn btn-ghost text-sm">
            <CheckCircle className="w-4 h-4" /> {t('epg.sources.massAssign')}
          </Link>
          <button
            onClick={() => void parseAll.mutateAsync()}
            disabled={parseAll.isPending}
            className="btn btn-ghost text-sm"
          >
            <RefreshCw className={cn('w-4 h-4', parseAll.isPending && 'animate-spin')} /> {t('epg.sources.updateAll')}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" /> {t('epg.sources.addSource')}
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={sources} isLoading={isLoading} emptyMessage={t('epg.sources.empty')} />

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={t('epg.sources.addSourceTitle')} size="md">
        <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4 p-6">
          <div>
            <label className="label">{t('epg.sources.sourceName')}</label>
            <input required className="input" value={form.name} onChange={f('name')} placeholder={t('epg.sources.sourceNamePlaceholder')} />
          </div>
          <div>
            <label className="label">XMLTV URL</label>
            <input required className="input" value={form.xmltvUrl} onChange={f('xmltvUrl')} placeholder="http://example.com/epg.xml" />
          </div>
          <div>
            <label className="label">{t('epg.sources.retentionDays')}</label>
            <input type="number" className="input" value={form.daysToKeep} onChange={f('daysToKeep')} min="1" max="30" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createSource.isPending}>{t('common.add')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
