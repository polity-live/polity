import type { ReactNode } from 'react';

/** Canvas overlay shared by City Design and Studio. The caller owns the request data and selection. */
export function CanvasChangeRequestList<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  title,
  emptyLabel,
  closeActionId,
  closeLabel = 'Close',
  renderItem,
}: {
  items: readonly T[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  title: string;
  emptyLabel: string;
  closeActionId?: string;
  closeLabel?: string;
  renderItem: (item: T, selected: boolean, select: () => void) => ReactNode;
}) {
  return (
    <div className="bg-background/95 pointer-events-auto absolute top-4 right-4 z-20 w-[min(18rem,calc(100%-2rem))] overflow-hidden rounded-md border text-sm shadow-xl backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">
          {title} ({items.length})
        </h2>
        {selectedId && (
          <button
            type="button"
            data-action-id={closeActionId}
            aria-label={closeLabel}
            onClick={() => onSelect(null)}
          >
            ×
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-auto p-2">
        {items.length === 0 ? (
          <div className="text-muted-foreground rounded-md border px-3 py-6 text-center text-sm">
            {emptyLabel}
          </div>
        ) : (
          items.map(item => (
            <div key={item.id}>
              {renderItem(item, selectedId === item.id, () => onSelect(item.id))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
