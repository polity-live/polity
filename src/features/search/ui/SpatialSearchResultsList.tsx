import { rowAttributes } from '@rocicorp/zero-virtual/react';
import type { CSSProperties, RefObject } from 'react';

import { cn } from '@/features/shared/utils/utils';
import { Card } from '@/features/shared/ui/ui/card';
import type { SearchDocument } from '../types/search-document.types';
import type { SpatialSearchListCell } from '../hooks/useSpatialSearchController';
import { SEARCH_CARD_HEIGHT } from './VirtualSearchGridView';
import { SearchResultCard } from './SearchResultCard';

interface SpatialSearchResultsListProps {
  parentRef: RefObject<HTMLDivElement | null>;
  cells: SpatialSearchListCell[];
  spaceBefore: number;
  spaceAfter: number;
  rowsEmpty: boolean;
  isComplete: boolean;
  emptyLabel: string;
  activeDocumentId?: string | null;
  onDocumentSelect: (document: SearchDocument) => void;
}

function SpatialSearchCardSkeleton() {
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
      </div>
    </Card>
  );
}

export function SpatialSearchResultsList({
  parentRef,
  cells,
  spaceBefore,
  spaceAfter,
  rowsEmpty,
  isComplete,
  emptyLabel,
  activeDocumentId,
  onDocumentSelect,
}: SpatialSearchResultsListProps) {
  return (
    <div
      ref={parentRef}
      className="scrollbar-hide h-[70dvh] min-h-[420px] overflow-auto pr-1 lg:h-[calc(100dvh-15rem)] lg:min-h-[520px]"
      data-testid="spatial-search-results-list"
    >
      {rowsEmpty && isComplete ? (
        <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-4" style={{ paddingTop: spaceBefore, paddingBottom: spaceAfter }}>
          {cells.map(cell => {
            const isActive = cell.document?.id === activeDocumentId;

            return (
              <div
                key={cell.key}
                {...rowAttributes(cell.index, cell.key)}
                style={{ height: SEARCH_CARD_HEIGHT }}
              >
                <div
                  data-search-document-id={cell.document?.id}
                  className={cn(
                    'civic-load-card-reveal h-full rounded-2xl border p-1 transition-colors',
                    isActive ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent'
                  )}
                  style={
                    {
                      '--civic-load-index': Math.min(cell.index, 11),
                    } as CSSProperties
                  }
                  onClick={() => {
                    if (cell.document) {
                      onDocumentSelect(cell.document);
                    }
                  }}
                >
                  {cell.document ? (
                    <SearchResultCard document={cell.document} />
                  ) : (
                    <SpatialSearchCardSkeleton />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
