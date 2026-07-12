import { useSpatialSearchController } from '../hooks/useSpatialSearchController';
import type { SearchListContext } from '../types/search-document.types';
import { SpatialSearchMap } from './SpatialSearchMap';
import { SpatialSearchResultsList } from './SpatialSearchResultsList';

interface SpatialSearchViewProps {
  context: SearchListContext;
  permalinkID?: string | null;
  onTotalChange?: (total: number | null) => void;
}

export function SpatialSearchView({ context, permalinkID, onTotalChange }: SpatialSearchViewProps) {
  const controller = useSpatialSearchController({ context, permalinkID, onTotalChange });

  return (
    <div
      className="grid h-full min-h-0 gap-4 overflow-auto lg:grid-cols-[minmax(360px,52vw)_minmax(320px,1fr)] lg:overflow-hidden"
      data-testid="spatial-search-view"
    >
      <div className="lg:h-full lg:min-h-0">
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
        spaceBefore={controller.spaceBefore}
        spaceAfter={controller.spaceAfter}
        rowsEmpty={controller.rowsEmpty}
        isComplete={controller.isComplete}
        emptyLabel={controller.emptyLabel}
        activeDocumentId={controller.activeDocumentId}
        onDocumentSelect={controller.onDocumentSelect}
      />
    </div>
  );
}
