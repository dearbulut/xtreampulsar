import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface Props {
  options: SelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchable = true,
  className,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
      >
        <span className={cn('flex-1 truncate text-sm', value.length === 0 ? 'text-muted' : 'text-slate-200')}>
          {value.length === 0
            ? (placeholder ?? t('ui.selectPlaceholder'))
            : value.length === 1
            ? selectedLabels[0]
            : t('ui.nSelected', { n: value.length })}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-muted hover:text-danger transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {searchable && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('ui.searchPlaceholder')}
                  className="input pl-7 py-1.5 text-xs"
                />
              </div>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">{t('ui.notFound')}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        value.includes(opt.value)
                          ? 'bg-primary border-primary'
                          : 'border-border',
                      )}
                    >
                      {value.includes(opt.value) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-slate-300">{opt.label}</span>
                  </div>
                  {opt.badge && (
                    <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">{opt.badge}</span>
                  )}
                </button>
              ))
            )}
          </div>
          {value.length > 0 && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted hover:text-danger transition-colors"
              >
                {t('ui.clearAll')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
