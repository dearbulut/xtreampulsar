import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, RefreshCw, Server, CheckCircle2, XCircle, HelpCircle, Globe } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, cn } from '@/lib/utils';
import {
  useProviders,
  usePreviewProvider,
  useCreateProvider,
  useReverifyProvider,
  useDeleteProvider,
  type ProviderPreview,
} from '@/hooks/useProviders';

function StatusPill({ status }: { status: string }) {
  const cfg =
    status === 'ONLINE'
      ? { icon: CheckCircle2, cls: 'text-success bg-success/10', label: 'ONLINE' }
      : status === 'OFFLINE'
      ? { icon: XCircle, cls: 'text-danger bg-danger/10', label: 'OFFLINE' }
      : { icon: HelpCircle, cls: 'text-muted bg-surface-2', label: '—' };
  const Icon = cfg.icon;
  return (
    <span className={cn('badge inline-flex items-center gap-1', cfg.cls)}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export function ProvidersPage() {
  const { t } = useTranslation();
  const { data: providers = [], isLoading } = useProviders();
  const preview = usePreviewProvider();
  const create = useCreateProvider();
  const reverify = useReverifyProvider();
  const del = useDeleteProvider();

  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [previewData, setPreviewData] = useState<ProviderPreview | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reset = () => { setUrl(''); setName(''); setUserAgent(''); setPreviewData(null); };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('providers.title')}
        description={t('providers.subtitle')}
        actions={
          <button className="btn-primary" onClick={() => { reset(); setShowAdd(true); }}>
            <Plus className="w-4 h-4" /> {t('providers.add')}
          </button>
        }
      />

      {isLoading ? (
        <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
      ) : providers.length === 0 ? (
        <div className="card p-10 flex flex-col items-center gap-3 text-muted">
          <Globe className="w-10 h-10 opacity-40" />
          <p className="text-sm">{t('providers.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {providers.map((p) => (
            <div key={p.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Server className="w-4 h-4 text-muted shrink-0" />
                  <span className="font-medium text-fg truncate">{p.name}</span>
                </div>
                <StatusPill status={p.status} />
              </div>
              <div className="text-xs text-muted font-mono truncate">{p.host}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted">{t('providers.user')}: </span><span className="text-fg">{p.username ?? '—'}</span></div>
                <div><span className="text-muted">{t('providers.maxConn')}: </span><span className="text-fg tabular-nums">{p.maxConnections ?? '—'}</span></div>
                <div><span className="text-muted">{t('providers.expiry')}: </span><span className="text-fg">{p.expiresAt ? formatDate(p.expiresAt) : '—'}</span></div>
                <div><span className="text-muted">{t('providers.checked')}: </span><span className="text-fg">{p.lastCheckedAt ? formatDate(p.lastCheckedAt) : '—'}</span></div>
              </div>
              {p.status === 'OFFLINE' && p.lastError && (
                <div className="text-[11px] text-danger truncate">{p.lastError}</div>
              )}
              <div className="flex gap-2 pt-1 border-t border-border mt-1">
                <button className="btn-ghost text-xs" disabled={reverify.isPending} onClick={() => reverify.mutate(p.id)}>
                  <RefreshCw className={cn('w-3.5 h-3.5', reverify.isPending && 'animate-spin')} /> {t('providers.reverify')}
                </button>
                <button className="btn-ghost text-xs text-danger ml-auto" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title={t('providers.addTitle')} size="md">
        <div className="space-y-3">
          <div>
            <label className="label">{t('providers.urlLabel')} *</label>
            <input
              className="input font-mono text-xs"
              placeholder="http://host:port/get.php?username=...&password=..."
              value={url}
              onChange={(e) => { setUrl(e.target.value); setPreviewData(null); }}
            />
            <p className="text-[11px] text-muted mt-1">{t('providers.urlHint')}</p>
          </div>
          <button
            className="btn-ghost text-sm"
            disabled={!url || preview.isPending}
            onClick={() => preview.mutate(url, { onSuccess: (d) => { setPreviewData(d); if (!name && d.host) { try { setName(new URL(d.host).host); } catch { /* ignore */ } } } })}
          >
            <RefreshCw className={cn('w-4 h-4', preview.isPending && 'animate-spin')} /> {t('providers.verify')}
          </button>

          {previewData && (
            <div className={cn('rounded-lg border p-3 text-xs space-y-1', previewData.ok ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5')}>
              <div className="flex items-center gap-2 font-semibold">
                {previewData.ok ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
                <span className={previewData.ok ? 'text-success' : 'text-danger'}>
                  {previewData.ok ? t('providers.verifyOk') : t('providers.verifyFail')}
                </span>
              </div>
              <div className="text-muted">Host: <span className="text-fg font-mono">{previewData.host}</span></div>
              <div className="text-muted">{t('providers.user')}: <span className="text-fg font-mono">{previewData.username ?? '—'}</span></div>
              {previewData.ok ? (
                <div className="text-muted">{t('providers.maxConn')}: <span className="text-fg">{previewData.maxConnections ?? '—'}</span> · {t('providers.expiry')}: <span className="text-fg">{previewData.expiresAt ? formatDate(previewData.expiresAt) : '—'}</span></div>
              ) : (
                <div className="text-danger">{previewData.error}</div>
              )}
            </div>
          )}

          <div>
            <label className="label">{t('providers.nameLabel')}</label>
            <input className="input" placeholder={t('providers.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('providers.userAgent')}</label>
            <input className="input font-mono text-xs" placeholder="XtreamPulsar/1.0" value={userAgent} onChange={(e) => setUserAgent(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button className="btn-ghost" onClick={() => { setShowAdd(false); reset(); }}>{t('common.cancel')}</button>
            <button
              className="btn-primary"
              disabled={!url || create.isPending}
              onClick={() => create.mutate(
                { url, name: name || undefined, userAgent: userAgent || undefined },
                { onSuccess: () => { setShowAdd(false); reset(); } },
              )}
            >
              {create.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title={t('providers.deleteTitle')}
        message={t('providers.deleteConfirm')}
        onConfirm={() => { if (deleteId) del.mutate(deleteId); setDeleteId(null); }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
