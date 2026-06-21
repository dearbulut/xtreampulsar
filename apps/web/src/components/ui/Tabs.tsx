import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
}

interface Props {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function Tabs({ tabs, active, onChange, variant = 'underline', className }: Props) {
  if (variant === 'pill') {
    return (
      <div className={cn('flex items-center gap-1 bg-surface-2 p-1 rounded-xl', className)}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                active === t.id
                  ? 'bg-surface text-slate-200 shadow-sm'
                  : 'text-muted hover:text-slate-200',
              )}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {t.label}
              {t.badge !== undefined && (
                <span className="text-[10px] bg-primary/20 text-primary-light px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex border-b border-border', className)}>
      {tabs.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
              active === t.id
                ? 'border-primary text-slate-200'
                : 'border-transparent text-muted hover:text-slate-300',
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {t.label}
            {t.badge !== undefined && (
              <span className="text-[10px] bg-primary/20 text-primary-light px-1.5 py-0.5 rounded-full ml-1">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
