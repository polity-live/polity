import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';

/** Canvas overlay shared by City Design and Studio. The caller owns the request data and selection. */
export function CanvasChangeRequestList<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  title,
  emptyLabel,
  closeActionId,
  closeLabel = 'Close',
  collapsible = false,
  renderItem,
}: {
  items: readonly T[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  title: string;
  emptyLabel: string;
  closeActionId?: string;
  closeLabel?: string;
  collapsible?: boolean;
  renderItem: (item: T, selected: boolean, select: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const content = (
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
  );
  const heading = (
    <>
      {title} ({items.length})
    </>
  );
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <div className="bg-background/95 pointer-events-auto absolute top-4 right-4 z-20 w-[min(18rem,calc(100%-2rem))] overflow-hidden rounded-md border text-sm shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <h2 className="min-w-0 flex-1 text-sm font-semibold">
            {collapsible ? (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="min-w-0 break-words">{heading}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${open ? '' : '-rotate-90'}`}
                  />
                </button>
              </CollapsibleTrigger>
            ) : (
              heading
            )}
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
        {collapsible ? <CollapsibleContent>{content}</CollapsibleContent> : content}
      </div>
    </Collapsible>
  );
}
