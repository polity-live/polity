import { useTranslation } from '@/features/shared/hooks/use-translation';
import { useState } from 'react';
import { cn } from '@/features/shared/utils/utils';

export interface TableSize {
  rowCount: number;
  colCount: number;
}

/** Shared dimensions picker. It has no Plate editor or document dependency. */
export function TableSizePicker({
  onSelect,
  rows = 8,
  columns = 8,
  label,
}: {
  onSelect: (size: TableSize) => void;
  rows?: number;
  columns?: number;
  label?: string;
}) {
  const { t } = useTranslation();
  const accessibleLabel = label ?? t('features.studio.tableSize');
  const [size, setSize] = useState<TableSize>({ rowCount: 0, colCount: 0 });
  const select = () => {
    if (size.rowCount > 0 && size.colCount > 0) onSelect(size);
  };
  return (
    <div
      data-action-id="shared.table-size.dimensions.choose"
      className="m-0 flex flex-col p-1"
      role="button"
      tabIndex={0}
      aria-label={t('features.studio.tableSizeDescription', {
        label: accessibleLabel,
        rows: size.rowCount,
        columns: size.colCount,
      })}
      onClick={event => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-table-size-row]');
        if (cell && event.currentTarget.contains(cell)) {
          event.stopPropagation();
          onSelect({
            rowCount: Number(cell.dataset.tableSizeRow),
            colCount: Number(cell.dataset.tableSizeColumn),
          });
        } else select();
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          select();
        } else if (event.key.startsWith('Arrow')) {
          event.preventDefault();
          event.stopPropagation();
          setSize(current => ({
            rowCount: Math.max(
              1,
              Math.min(
                rows,
                current.rowCount +
                  (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)
              )
            ),
            colCount: Math.max(
              1,
              Math.min(
                columns,
                current.colCount +
                  (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)
              )
            ),
          }));
        }
      }}
    >
      <div
        className="grid gap-0.5 p-1"
        style={{ gridTemplateColumns: `repeat(${columns}, 0.75rem)` }}
        aria-hidden="true"
      >
        {Array.from({ length: rows * columns }, (_, index) => {
          const row = Math.floor(index / columns);
          const column = index % columns;
          return (
            <div
              key={index}
              data-table-size-row={row + 1}
              data-table-size-column={column + 1}
              className={cn(
                'bg-secondary size-3 border border-solid',
                row < size.rowCount && column < size.colCount && 'bg-primary/20 border-current'
              )}
              onMouseMove={() => setSize({ rowCount: row + 1, colCount: column + 1 })}
            />
          );
        })}
      </div>
      <span className="text-center text-xs" aria-live="polite">
        {size.rowCount} x {size.colCount}
      </span>
    </div>
  );
}
