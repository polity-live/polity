import type { Key, RefCallback, RefObject, UIEventHandler } from 'react';

import { Button } from '@/features/shared/ui/ui/button';
import { Card } from '@/features/shared/ui/ui/card';
import type { SearchDocument } from '../types/search-document.types';
import { SearchResultCard } from './SearchResultCard';

export const SEARCH_CARD_HEIGHT = 360;
export const SEARCH_GRID_GAP = 16;

export interface VirtualSearchGridCell {
  key: Key;
  index: number;
  top: number;
  left: number;
  width: number;
  document?: SearchDocument | null;
}

interface VirtualSearchGridViewProps {
  parentRef: RefObject<HTMLDivElement | null>;
  cells: VirtualSearchGridCell[];
  totalHeight: number;
  showNewResults: boolean;
  rowsEmpty: boolean;
  isComplete: boolean;
  newResultsLabel: string;
  emptyLabel: string;
  onJumpToTop: () => void;
  onScroll: UIEventHandler<HTMLDivElement>;
  onMeasureElement: RefCallback<HTMLDivElement>;
}

function SearchCardSkeleton() {
  return (
    <Card surface="search" shape="xl" className="h-full overflow-hidden">
      <div className="bg-muted/80 h-24 animate-pulse p-4">
        <div className="bg-background/70 h-5 w-2/3 rounded" />
        <div className="bg-background/60 mt-2 h-3 w-1/2 rounded" />
      </div>
      <div className="space-y-3 p-4">
        <div className="bg-muted h-4 animate-pulse rounded" />
        <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
        <div className="flex gap-2 pt-1">
          <div className="bg-muted h-5 w-16 animate-pulse rounded" />
          <div className="bg-muted h-5 w-20 animate-pulse rounded" />
        </div>
        <div className="mt-8 flex gap-2">
          <div className="bg-muted h-8 w-20 animate-pulse rounded-md" />
          <div className="bg-muted h-8 w-8 animate-pulse rounded-md" />
        </div>
      </div>
    </Card>
  );
}

export function VirtualSearchGridView({
  parentRef,
  cells,
  totalHeight,
  showNewResults,
  rowsEmpty,
  isComplete,
  newResultsLabel,
  emptyLabel,
  onJumpToTop,
  onScroll,
  onMeasureElement,
}: VirtualSearchGridViewProps) {
  return (
    <div className="relative">
      {showNewResults ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
          <Button
            presentation="floatingShadow"
            className="pointer-events-auto"
            size="sm"
            onClick={onJumpToTop}
          >
            {newResultsLabel}
          </Button>
        </div>
      ) : null}

      <div
        ref={parentRef}
        onScroll={onScroll}
        className="h-[calc(100dvh-15rem)] min-h-[520px] overflow-auto pr-1"
      >
        {rowsEmpty && isComplete ? (
          <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm">
            {emptyLabel}
          </div>
        ) : (
          <div className="relative" style={{ height: totalHeight }}>
            {cells.map(cell => (
              <div
                key={cell.key}
                data-index={cell.index}
                ref={onMeasureElement}
                className="absolute"
                style={{
                  height: SEARCH_CARD_HEIGHT,
                  width: cell.width,
                  transform: `translate(${cell.left}px, ${cell.top}px)`,
                }}
              >
                {cell.document ? (
                  <SearchResultCard document={cell.document} />
                ) : (
                  <SearchCardSkeleton />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
