import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  label: string;
  description?: string;
}

interface Props {
  steps: WizardStep[];
  current: number;
  className?: string;
}

export function Wizard({ steps, current, className }: Props) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, i) => {
        const done = i < current - 1;
        const active = i === current - 1;
        const upcoming = i > current - 1;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  done && 'bg-success text-white',
                  active && 'bg-primary text-white ring-4 ring-primary/20',
                  upcoming && 'bg-surface-2 text-muted border border-border',
                )}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <div className="mt-1.5 text-center">
                <div
                  className={cn(
                    'text-xs font-medium',
                    active ? 'text-slate-200' : done ? 'text-success' : 'text-muted',
                  )}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-[10px] text-muted hidden sm:block">{step.description}</div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-2 mb-6 transition-colors',
                  done ? 'bg-success' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
