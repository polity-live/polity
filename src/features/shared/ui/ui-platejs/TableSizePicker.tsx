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
  label = 'Table size',
}: {
  onSelect: (size: TableSize) => void;
  rows?: number;
  columns?: number;
  label?: string;
}) {
  const [size, setSize] = useState<TableSize>({ rowCount: 0, colCount: 0 });
  const select = () => {
    if (size.rowCount > 0 && size.colCount > 0) onSelect(size);
  };
  return (
    <div
      className="m-0 flex flex-col p-1"
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${size.rowCount} x ${size.colCount}`}
      onClick={select}
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
              className={cn(
                'bg-secondary size-3 border border-solid',
                row < size.rowCount && column < size.colCount && 'bg-primary/20 border-current'
              )}
              onMouseMove={() => setSize({ rowCount: row + 1, colCount: column + 1 })}
              onClick={event => {
                event.stopPropagation();
                onSelect({ rowCount: row + 1, colCount: column + 1 });
              }}
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
