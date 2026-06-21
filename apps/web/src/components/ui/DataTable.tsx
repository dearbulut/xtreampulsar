import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (p: number) => void;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;
  onSelectId?: (id: string) => void;
  onSelectAll?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  onRowClick,
  selectedIds,
  onSelectId,
  onSelectAll,
  emptyTitle,
  emptyDescription,
  stickyHeader,
}: Props<T>) {
  const allSelected = selectedIds && data.length > 0 && data.every((r) => selectedIds.has(keyExtractor(r)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="border-b border-border">
              {(onSelectId || onSelectAll) && (
                <th className="table-th w-10">
                  {onSelectAll && (
                    <input
                      type="checkbox"
                      checked={!!allSelected}
                      onChange={onSelectAll}
                      className="accent-primary w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={cn('table-th', col.headerClassName)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const id = keyExtractor(row);
              const selected = selectedIds?.has(id);
              return (
                <tr
                  key={id}
                  className={cn('table-row', onRowClick && 'cursor-pointer', selected && 'bg-primary/5')}
                  onClick={() => onRowClick?.(row)}
                >
                  {onSelectId && (
                    <td className="table-td w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => onSelectId(id)}
                        className="accent-primary w-3.5 h-3.5 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('table-td', col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface">
          <div className="text-xs text-muted">
            {total !== undefined && `Toplam ${total} kayıt`}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-muted hover:text-slate-200 hover:bg-surface-2 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'w-7 h-7 rounded-lg text-xs transition-colors',
                    page === p
                      ? 'bg-primary text-white font-medium'
                      : 'text-muted hover:text-slate-200 hover:bg-surface-2',
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-muted hover:text-slate-200 hover:bg-surface-2 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
