import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareWarning, TvMinimal, Check, X, RotateCcw, Inbox } from 'lucide-react';
import { useClientRequests, useUpdateClientRequest, type ClientRequest } from '@/hooks/useClientRequests';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<ClientRequest['status'], string> = {
  OPEN: 'badge-warning',
  RESOLVED: 'badge-success',
  REJECTED: 'badge-danger',
};

export function ClientRequestsPage() {
  const { t } = useTranslation();
  const [type, setType] = useState<'' | 'REPORT' | 'NEW_CHANNEL'>('');
  const [status, setStatus] = useState<'' | 'OPEN' | 'RESOLVED' | 'REJECTED'>('OPEN');
  const { data, isLoading } = useClientRequests({ type: type || undefined, status: status || undefined });
  const update = useUpdateClientRequest();
  const items = data?.items ?? [];

  const typeTabs: { key: '' | 'REPORT' | 'NEW_CHANNEL'; label: string }[] = [
    { key: '', label: t('clientRequests.all') },
    { key: 'REPORT', label: t('clientRequests.reports') },
    { key: 'NEW_CHANNEL', label: t('clientRequests.requests') },
  ];
  const statusTabs: { key: '' | 'OPEN' | 'RESOLVED' | 'REJECTED'; label: string }[] = [
    { key: 'OPEN', label: t('clientRequests.statusOpen') },
    { key: 'RESOLVED', label: t('clientRequests.statusResolved') },
    { key: 'REJECTED', label: t('clientRequests.statusRejected') },
    { key: '', label: t('clientRequests.allStatuses') },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t('clientRequests.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('clientRequests.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {typeTabs.map((tab) => (
            <button
              key={tab.key || 'all'}
              onClick={() => setType(tab.key)}
              className={cn('px-3 py-1.5 text-sm rounded-lg transition-colors',
                type === tab.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab.key || 'allst'}
              onClick={() => setStatus(tab.key)}
              className={cn('px-3 py-1.5 text-sm rounded-lg transition-colors',
                status === tab.key ? 'bg-primary text-white' : 'bg-surface-2 text-muted hover:text-fg')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center gap-2">
            <Inbox className="w-10 h-10 text-muted/50" />
            <p className="text-sm text-muted">{t('clientRequests.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">{t('clientRequests.colType')}</th>
                  <th className="table-th">{t('clientRequests.colUser')}</th>
                  <th className="table-th">{t('clientRequests.colDetail')}</th>
                  <th className="table-th">{t('clientRequests.colDate')}</th>
                  <th className="table-th">{t('clientRequests.colStatus')}</th>
                  <th className="table-th text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-td">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium',
                        r.type === 'REPORT' ? 'text-warning' : 'text-info')}>
                        {r.type === 'REPORT' ? <MessageSquareWarning className="w-4 h-4" /> : <TvMinimal className="w-4 h-4" />}
                        {r.type === 'REPORT' ? t('clientRequests.report') : t('clientRequests.request')}
                      </span>
                    </td>
                    <td className="table-td">
                      <span className="font-mono text-sm">{r.user?.username ?? '—'}</span>
                    </td>
                    <td className="table-td max-w-md">
                      <div className="font-medium text-fg truncate">
                        {r.stream?.name ? `${r.stream.name} — ` : ''}{r.title}
                      </div>
                      {r.message && <div className="text-xs text-muted line-clamp-2">{r.message}</div>}
                      {r.adminNote && <div className="text-xs text-primary-light mt-0.5">↳ {r.adminNote}</div>}
                    </td>
                    <td className="table-td whitespace-nowrap text-xs text-muted">{formatDate(r.createdAt)}</td>
                    <td className="table-td">
                      <span className={cn('badge', STATUS_BADGE[r.status])}>
                        {t(`clientRequests.status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        {r.status !== 'RESOLVED' && (
                          <button className="btn-ghost p-1.5" title={t('clientRequests.resolve')}
                            onClick={() => update.mutate({ id: r.id, status: 'RESOLVED' })}>
                            <Check className="w-4 h-4 text-success" />
                          </button>
                        )}
                        {r.status !== 'REJECTED' && (
                          <button className="btn-ghost p-1.5" title={t('clientRequests.reject')}
                            onClick={() => update.mutate({ id: r.id, status: 'REJECTED' })}>
                            <X className="w-4 h-4 text-danger" />
                          </button>
                        )}
                        {r.status !== 'OPEN' && (
                          <button className="btn-ghost p-1.5" title={t('clientRequests.reopen')}
                            onClick={() => update.mutate({ id: r.id, status: 'OPEN' })}>
                            <RotateCcw className="w-4 h-4 text-muted" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
