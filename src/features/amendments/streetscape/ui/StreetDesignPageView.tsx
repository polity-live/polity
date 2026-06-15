import { Save } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import type { Amendment } from '@/zero/amendments/schema';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignBoundingBox,
  StreetDesignCostLine,
  StreetDesignCostSummary,
  StreetDesignGeoPoint,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignMapSelection,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignOsmWay,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import { StreetAreaPicker } from './StreetAreaPicker';
import { StreetCostSummaryView } from './StreetCostSummaryView';
import { StreetDesignInspectorView } from './StreetDesignInspectorView';
import { StreetDesignToolbarView } from './StreetDesignToolbarView';
import { StreetSceneCanvasView } from './StreetSceneCanvasView';

interface StreetDesignPageViewProps {
  amendment: Amendment | null | undefined;
  isLoading: boolean;
  readOnly: boolean;
  design: StreetDesignStateV1;
  selectedObject: StreetDesignObject | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  selectedObjectCostLine: StreetDesignCostLine | null;
  selectedObjectId: string | null;
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  selectedCenter: StreetDesignGeoPoint;
  selectedBbox: StreetDesignBoundingBox;
  selectedMapSelection: StreetDesignMapSelection;
  costSummary: StreetDesignCostSummary;
  isDirty: boolean;
  placementPreview: CorridorGeometry | PathCorridorGeometry | null;
  placementPreviewType: StreetDesignObjectType | null;
  placementStart: StreetDesignLocalPoint | null;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  osmLayerVisibility: StreetDesignOsmLayerVisibility;
  showStreetMarkings: boolean;
  isLoadingOsm: boolean;
  osmError: string | null;
  isSaving: boolean;
  saveError: string | null;
  onSelectedMapSelectionChange: (selection: StreetDesignMapSelection) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
  onSave: () => void;
  onToolChange: (type: StreetDesignObjectType) => void;
  onInteractionModeChange: (mode: StreetDesignInteractionMode) => void;
  onComparisonModeChange: (mode: StreetDesignStateV1['comparisonMode']) => void;
  onScenePointerDown: (point: StreetDesignLocalPoint) => void;
  onScenePointerMove: (point: StreetDesignLocalPoint) => void;
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onOsmWayHide: (osmWayId: string) => void;
  onOsmLayerVisibilityChange: (
    layer: keyof StreetDesignOsmLayerVisibility,
    visible: boolean
  ) => void;
  onShowStreetMarkingsChange: (visible: boolean) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
}

export function StreetDesignPageView({
  amendment,
  isLoading,
  readOnly,
  design,
  selectedObject,
  selectedOsmWay,
  selectedObjectCostLine,
  selectedObjectId,
  selectedTool,
  interactionMode,
  selectedCenter,
  selectedBbox,
  selectedMapSelection,
  costSummary,
  isDirty,
  placementPreview,
  placementPreviewType,
  placementStart,
  placementMode,
  placementPointCount,
  canFinishPathPlacement,
  osmLayerVisibility,
  showStreetMarkings,
  isLoadingOsm,
  osmError,
  isSaving,
  saveError,
  onSelectedMapSelectionChange,
  onLoadOsm,
  onLoadSample,
  onSave,
  onToolChange,
  onInteractionModeChange,
  onComparisonModeChange,
  onScenePointerDown,
  onScenePointerMove,
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onOsmWayHide,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
  onPropertyChange,
  onWidthChange,
  onUnitCostChange,
  onDeleteObject,
}: StreetDesignPageViewProps) {
  if (isLoading) {
    return <GlobalLoadingAnimation connectionStatus="connecting" />;
  }

  if (!amendment) {
    return <NotFound />;
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Amendment</p>
          <h1 className="text-2xl font-semibold">{amendment.title ?? 'Strassenentwurf'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saveError ? <span className="text-destructive text-xs">{saveError}</span> : null}
          <Button type="button" onClick={onSave} disabled={readOnly || isSaving || !isDirty}>
            <Save className="size-4" />
            {isSaving ? 'Speichert...' : 'Speichern'}
          </Button>
        </div>
      </header>

      <StreetAreaPicker
        center={selectedCenter}
        bbox={selectedBbox}
        mapSelection={selectedMapSelection}
        isLoadingOsm={isLoadingOsm}
        osmError={osmError}
        readOnly={readOnly}
        onMapSelectionChange={onSelectedMapSelectionChange}
        onLoadOsm={onLoadOsm}
        onLoadSample={onLoadSample}
      />

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <StreetDesignToolbarView
          selectedTool={selectedTool}
          interactionMode={interactionMode}
          comparisonMode={design.comparisonMode}
          osmLayerVisibility={osmLayerVisibility}
          showStreetMarkings={showStreetMarkings}
          readOnly={readOnly}
          onToolChange={onToolChange}
          onInteractionModeChange={onInteractionModeChange}
          onComparisonModeChange={onComparisonModeChange}
          onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
          onShowStreetMarkingsChange={onShowStreetMarkingsChange}
        />
        <StreetSceneCanvasView
          design={design}
          placementPreview={placementPreview}
          placementPreviewType={placementPreviewType}
          placementStart={placementStart}
          placementMode={placementMode}
          placementPointCount={placementPointCount}
          canFinishPathPlacement={canFinishPathPlacement}
          selectedObjectId={selectedObjectId}
          selectedObject={selectedObject}
          selectedOsmWayId={selectedOsmWay?.id ?? null}
          interactionMode={interactionMode}
          readOnly={readOnly}
          onPointerDown={onScenePointerDown}
          onPointerMove={onScenePointerMove}
          onFinishPlacement={onFinishPlacement}
          onFinishPathPlacement={onFinishPathPlacement}
          onCancelPlacement={onCancelPlacement}
          onObjectSelect={onObjectSelect}
          onOsmWaySelect={onOsmWaySelect}
          onDeleteObject={onDeleteObject}
        />
        <StreetDesignInspectorView
          selectedObject={selectedObject}
          selectedOsmWay={selectedOsmWay}
          selectedObjectCostLine={selectedObjectCostLine}
          readOnly={readOnly}
          onPropertyChange={onPropertyChange}
          onWidthChange={onWidthChange}
          onUnitCostChange={onUnitCostChange}
          onDeleteObject={onDeleteObject}
          onHideOsmWay={onOsmWayHide}
        />
      </div>

      <StreetCostSummaryView
        summary={costSummary}
        readOnly={readOnly}
        onDeleteObject={onDeleteObject}
      />
    </main>
  );
}
