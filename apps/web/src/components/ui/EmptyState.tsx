import { type LucideIcon, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted" />
      </div>
      <h3 className="text-slate-200 font-medium mb-1">{title ?? t('ui.emptyTitle')}</h3>
      <p className="text-muted text-sm max-w-xs mb-4">{description ?? t('ui.emptyDescription')}</p>
      {action}
    </div>
  );
}
