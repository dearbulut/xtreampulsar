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
  ACTIVE:    { label: 'Aktif',     dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  ONLINE:    { label: 'Online',    dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  RUNNING:   { label: 'Çalışıyor', dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  COMPLETED: { label: 'Tamamlandı', dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },

  DISABLED:  { label: 'Devre dışı', dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  IDLE:      { label: 'Bekliyor',   dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  STOPPED:   { label: 'Durduruldu', dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },
  PENDING:   { label: 'Bekliyor',   dot: 'bg-muted', bg: 'bg-muted/10', text: 'text-muted' },

  EXPIRED:   { label: 'Süresi Doldu', dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },
  BUFFERING: { label: 'Tamponlama',   dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },

  BANNED:    { label: 'Yasaklı', dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  OFFLINE:   { label: 'Offline', dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  CRASHED:   { label: 'Çöktü',   dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  ERROR:     { label: 'Hata',    dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
  FAILED:    { label: 'Başarısız', dot: 'bg-danger', bg: 'bg-danger/10', text: 'text-danger' },
};

interface Props {
  status: Status;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: Props) {
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
      {cfg.label}
    </span>
  );
}
