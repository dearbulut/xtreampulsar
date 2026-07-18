import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bell, CheckCheck, CreditCard, Clock, Info } from 'lucide-react';
import {
  useResellerNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type ResellerNotification,
} from '@/hooks/useResellerPanel';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'unread' | 'LOW_CREDIT' | 'USER_EXPIRING';

function timeAgo(dateStr: string, t: TFunction): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t('layout.justNow');
  if (diff < 3600) return t('layout.minutesAgo', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('layout.hoursAgo', { n: Math.floor(diff / 3600) });
  return t('layout.daysAgo', { n: Math.floor(diff / 86400) });
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'LOW_CREDIT') {
    return (
      <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
        <CreditCard className="w-4 h-4 text-amber-400" />
      </div>
    );
  }
  if (type === 'USER_EXPIRING') {
    return (
      <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
        <Clock className="w-4 h-4 text-orange-400" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
      <Info className="w-4 h-4 text-blue-400" />
    </div>
  );
}

function NotifRow({ n, onRead }: { n: ResellerNotification; onRead: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={() => { if (!n.isRead) onRead(n.id); }}
      className={cn(
        'w-full text-left flex items-start gap-3 px-5 py-4 border-b border-border/60 transition-colors hover:bg-surface-2/40',
        !n.isRead && 'bg-primary/5',
      )}
    >
      <NotifIcon type={n.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('text-sm font-medium leading-snug', n.isRead ? 'text-slate-400' : 'text-slate-200')}>
            {n.title}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-muted/60 whitespace-nowrap">{timeAgo(n.createdAt, t)}</span>
            {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
          </div>
        </div>
        <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
      </div>
    </button>
  );
}

export function ResellerNotificationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data: all = [], isLoading } = useResellerNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const filtered = all.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'LOW_CREDIT' || filter === 'USER_EXPIRING') return n.type === filter;
    return true;
  });

  const unreadCount = all.filter((n) => !n.isRead).length;

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('reseller.notifications.filterAll') },
    { key: 'unread', label: t('reseller.notifications.filterUnread', { n: unreadCount }) },
    { key: 'LOW_CREDIT', label: t('reseller.notifications.filterCredit') },
    { key: 'USER_EXPIRING', label: t('reseller.notifications.filterExpiring') },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">{t('reseller.notifications.title')}</h1>
          <p className="text-sm text-muted">{t('reseller.notifications.subtitle', { total: all.length, unread: unreadCount })}</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <CheckCheck className="w-4 h-4" />
            {t('reseller.notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-colors',
              filter === key
                ? 'bg-primary/20 border-primary text-primary'
                : 'border-border text-muted hover:text-fg hover:border-border/80',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Bell className="w-10 h-10 text-muted/20 mx-auto mb-3" />
            <p className="text-sm text-muted">{t('reseller.notifications.noNotifications')}</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotifRow key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
          ))
        )}
      </div>
    </div>
  );
}
