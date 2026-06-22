import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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
  keyExtractor?: (row: T) => string;
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
  emptyMessage?: string;
  stickyHeader?: boolean;
}

/** Returns the page numbers (or '...') to render in the pagination bar. */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 1) return [1];

  const pageSet = new Set<number>();
  pageSet.add(1);
  pageSet.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) pageSet.add(i);
  }

  const sorted = [...pageSet].sort((a, b) => a - b);
  const result: (number | '...')[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap === 2) {
        result.push(sorted[i] - 1); // insert the single missing page instead of '...'
      } else if (gap > 2) {
        result.push('...');
      }
    }
    result.push(sorted[i]);
  }

  return result;
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
  emptyMessage,
  stickyHeader,
}: Props<T>) {
  const getKey = keyExtractor ?? ((row: T) => String((row as Record<string, unknown>).id ?? Math.random()));
  const allSelected = selectedIds && data.length > 0 && data.every((r) => selectedIds.has(getKey(r)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState title={emptyMessage ?? emptyTitle} description={emptyDescription} />;
  }

  const pageNumbers = getPageNumbers(page, totalPages);

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
              const id = getKey(row);
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

      {onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface flex-wrap gap-2">
          {/* Left: record count + page info */}
          <div className="flex items-center gap-3 text-xs text-muted">
            {total !== undefined && <span>Toplam {total.toLocaleString()} kayıt</span>}
            {totalPages > 1 && (
              <span className="font-medium" style={{ color: 'var(--color-fg)' }}>
                Sayfa {page} / {totalPages}
              </span>
            )}
          </div>

          {/* Right: pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-0.5">
              {/* İlk */}
              <button
                onClick={() => onPageChange(1)}
                disabled={page <= 1}
                title="İlk sayfa"
                className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 transition-colors"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Önceki */}
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                title="Önceki sayfa"
                className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers with ellipsis */}
              {pageNumbers.map((p, i) =>
                p === '...' ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-1 text-xs text-muted select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={cn(
                      'min-w-[28px] h-7 px-1.5 rounded-lg text-xs transition-colors',
                      page === p
                        ? 'bg-primary text-white font-medium'
                        : 'text-muted hover:text-fg hover:bg-surface-2',
                    )}
                  >
                    {p}
                  </button>
                ),
              )}

              {/* Sonraki */}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                title="Sonraki sayfa"
                className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Son */}
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={page >= totalPages}
                title="Son sayfa"
                className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-2 disabled:opacity-30 transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
