import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'primary';

const variantCfg: Record<Variant, { icon: string; value: string; border: string }> = {
  default:  { icon: 'text-muted bg-surface-2',           value: 'text-slate-100', border: 'border-border' },
  primary:  { icon: 'text-primary bg-primary/10',         value: 'text-primary-light', border: 'border-primary/20' },
  success:  { icon: 'text-success bg-success-bg',         value: 'text-success', border: 'border-success/20' },
  danger:   { icon: 'text-danger bg-danger-bg',           value: 'text-danger', border: 'border-danger/20' },
  warning:  { icon: 'text-warning bg-warning-bg',         value: 'text-warning', border: 'border-warning/20' },
  info:     { icon: 'text-info bg-info-bg',               value: 'text-info', border: 'border-info/20' },
};

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: Variant;
  trend?: { value: number; label: string };
  live?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  live,
  className,
}: Props) {
  const cfg = variantCfg[variant];

  return (
    <div className={cn('card p-5 flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', cfg.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {live && (
          <span className="flex items-center gap-1 text-xs text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
            LIVE
          </span>
        )}
      </div>

      <div>
        <div className={cn('text-2xl font-bold tabular-nums', cfg.value)}>{value}</div>
        <div className="text-xs text-muted mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-muted/70 mt-0.5">{subtitle}</div>}
      </div>

      {trend && (
        <div className={cn('text-xs font-medium', trend.value >= 0 ? 'text-success' : 'text-danger')}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
}
