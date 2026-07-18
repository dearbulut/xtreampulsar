import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Status =
  | 'ACTIVE'
  | 'DISABLED'
  | 'EXPIRED'
  | 'BANNED'
  | 'ONLINE'
  | 'OFFLINE'
  | 'RUNNING'
  | 'CRASHED'
  | 'STOPPED'
  | 'IDLE'
  | 'BUFFERING'
  | 'ERROR'
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | string;

const MAP: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ACTIVE:    { label: 'ui.status.active',    dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  ONLINE:    { label: 'ui.status.online',    dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  RUNNING:   { label: 'ui.status.running',   dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  COMPLETED: { label: 'ui.status.completed', dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },

  DISABLED:  { label: 'ui.status.disabled',  dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  IDLE:      { label: 'ui.status.idle',      dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  STOPPED:   { label: 'ui.status.stopped',   dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  PENDING:   { label: 'ui.status.pending',   dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },

  EXPIRED:   { label: 'ui.status.expired',   dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },
  BUFFERING: { label: 'ui.status.buffering', dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },

  BANNED:    { label: 'ui.status.banned',  dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  OFFLINE:   { label: 'ui.status.offline', dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  CRASHED:   { label: 'ui.status.crashed', dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  ERROR:     { label: 'ui.status.error',   dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  FAILED:    { label: 'ui.status.failed',  dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
};

interface Props {
  status: Status;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: Props) {
  const { t } = useTranslation();
  const cfg = MAP[status] ?? {
    label: status,
    dot: 'bg-muted',
    bg: 'bg-muted/10',
    text: 'text-muted',
  };

  return (
    <span className={cn('badge', cfg.bg, cfg.text, className)}>
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0', cfg.dot)} />
      )}
      {t(cfg.label)}
    </span>
  );
}
