import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  accept?: string;
  maxSizeMB?: number;
  onFile: (file: File) => void;
  label?: string;
  sublabel?: string;
  file?: File | null;
  onClear?: () => void;
}

export function FileUpload({
  accept = '*',
  maxSizeMB = 50,
  onFile,
  label = 'Dosya yükle veya sürükle',
  sublabel,
  file,
  onClear,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (f: File): boolean => {
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`Dosya boyutu ${maxSizeMB}MB'dan büyük olamaz`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && validate(f)) onFile(f);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && validate(f)) onFile(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/5 border border-success/20 rounded-xl">
        <FileText className="w-8 h-8 text-success flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{file.name}</div>
          <div className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted hover:text-danger transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          dragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-surface-2',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className={cn('w-10 h-10 mx-auto mb-3', dragging ? 'text-primary' : 'text-muted')} />
        <div className="text-sm font-medium text-slate-300 mb-1">{label}</div>
        {sublabel && <div className="text-xs text-muted">{sublabel}</div>}
        {!sublabel && (
          <div className="text-xs text-muted">
            Maks {maxSizeMB}MB{accept !== '*' ? ` • ${accept}` : ''}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {error && <div className="text-xs text-danger mt-1.5">{error}</div>}
    </div>
  );
}
