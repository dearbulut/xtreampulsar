import { cn } from '@/lib/utils';

type Variant = 'default' | 'success' | 'danger' | 'warning';

const barColor: Record<Variant, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
};

interface Props {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  variant?: Variant;
  showPercent?: boolean;
  animate?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  sublabel,
  variant = 'default',
  showPercent = true,
  animate = true,
  className,
}: Props) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-2">
          <div>
            {label && <div className="text-sm font-medium text-slate-200">{label}</div>}
            {sublabel && <div className="text-xs text-muted">{sublabel}</div>}
          </div>
          {showPercent && (
            <span className="text-sm font-semibold tabular-nums text-slate-200">{pct}%</span>
          )}
        </div>
      )}
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            barColor[variant],
            animate && 'animate-pulse-slow',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {max !== 100 && (
        <div className="flex justify-between mt-1 text-xs text-muted">
          <span>{value.toLocaleString()} kayıt işlendi</span>
          <span>{max.toLocaleString()} toplam</span>
        </div>
      )}
    </div>
  );
}
