import { useSpatialSearchController } from '../hooks/useSpatialSearchController';
import type { SearchListContext } from '../types/search-document.types';
import { SpatialSearchMap } from './SpatialSearchMap';
import { SpatialSearchResultsList } from './SpatialSearchResultsList';

interface SpatialSearchViewProps {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number) => void;
}

export function SpatialSearchView({ context, permalinkID, onTotalChange }: SpatialSearchViewProps) {
  const controller = useSpatialSearchController({ context, permalinkID, onTotalChange });

  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(360px,52vw)_minmax(320px,1fr)]"
      data-testid="spatial-search-view"
    >
      <div className="lg:sticky lg:top-28 lg:self-start">
        <SpatialSearchMap
          items={controller.mapItems}
          activeItem={controller.activeMapItem}
          activeDocumentId={controller.activeDocumentId}
          center={controller.mapCenter}
          onBoundsChange={controller.onBoundsChange}
          onActiveDocumentChange={controller.onActiveDocumentChange}
          onItemSelect={controller.onMapItemSelect}
        />
      </div>

      <SpatialSearchResultsList
        parentRef={controller.parentRef}
        cells={controller.cells}
        totalHeight={controller.totalHeight}
        rowsEmpty={controller.rowsEmpty}
        isComplete={controller.isComplete}
        emptyLabel={controller.emptyLabel}
        activeDocumentId={controller.activeDocumentId}
        onDocumentSelect={controller.onDocumentSelect}
        onMeasureElement={controller.onMeasureElement}
      />
    </div>
  );
}
