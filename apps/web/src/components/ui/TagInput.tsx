import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ value, onChange, placeholder = 'Ekle…', className }: Props) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const tags = raw.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    const next = [...new Set([...value, ...tags])];
    onChange(next);
    setInput('');
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) add(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 p-2 bg-surface-2 border border-border rounded-lg min-h-[42px] cursor-text',
        'focus-within:ring-1 focus-within:ring-primary focus-within:border-primary',
        className,
      )}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-primary/10 text-primary-light text-xs px-2 py-0.5 rounded-md"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(tag); }}
            className="hover:text-danger transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-20 bg-transparent text-sm text-slate-200 placeholder-muted outline-none"
      />
    </div>
  );
}
