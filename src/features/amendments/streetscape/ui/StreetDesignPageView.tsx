import { Save } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { GlobalLoadingAnimation } from '@/features/shared/ui/ui/global-loading-animation';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import type { Amendment } from '@/zero/amendments/schema';
import type {
  StreetDesignBoundingBox,
  StreetDesignCostSummary,
  StreetDesignGeoPoint,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectType,
  StreetDesignPlacementDraft,
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
  canEdit: boolean;
  design: StreetDesignStateV1;
  selectedObject: StreetDesignObject | null;
  selectedObjectId: string | null;
  selectedTool: StreetDesignObjectType;
  selectedCenter: StreetDesignGeoPoint;
  selectedBbox: StreetDesignBoundingBox;
  costSummary: StreetDesignCostSummary;
  isDirty: boolean;
  isLoadingOsm: boolean;
  osmError: string | null;
  isSaving: boolean;
  saveError: string | null;
  placementDraft: StreetDesignPlacementDraft | null;
  onSelectedCenterChange: (center: StreetDesignGeoPoint) => void;
  onLoadOsm: () => void;
  onLoadSample: () => void;
  onSave: () => void;
  onToolChange: (type: StreetDesignObjectType) => void;
  onComparisonModeChange: (mode: StreetDesignStateV1['comparisonMode']) => void;
  onScenePointerDown: (point: StreetDesignLocalPoint) => void;
  onScenePointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
}

export function StreetDesignPageView({
  amendment,
  isLoading,
  canEdit,
  design,
  selectedObject,
  selectedObjectId,
  selectedTool,
  selectedCenter,
  selectedBbox,
  costSummary,
  isDirty,
  isLoadingOsm,
  osmError,
  isSaving,
  saveError,
  placementDraft,
  onSelectedCenterChange,
  onLoadOsm,
  onLoadSample,
  onSave,
  onToolChange,
  onComparisonModeChange,
  onScenePointerDown,
  onScenePointerMove,
  onObjectSelect,
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

  const readOnly = !canEdit;
  const corridorPreview =
    placementDraft?.preview && placementDraft.preview.kind === 'corridor'
      ? placementDraft.preview
      : null;

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
        isLoadingOsm={isLoadingOsm}
        osmError={osmError}
        readOnly={readOnly}
        onCenterChange={onSelectedCenterChange}
        onLoadOsm={onLoadOsm}
        onLoadSample={onLoadSample}
      />

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <StreetDesignToolbarView
          selectedTool={selectedTool}
          comparisonMode={design.comparisonMode}
          readOnly={readOnly}
          onToolChange={onToolChange}
          onComparisonModeChange={onComparisonModeChange}
        />
        <StreetSceneCanvasView
          design={design}
          placementPreview={corridorPreview}
          selectedObjectId={selectedObjectId}
          readOnly={readOnly}
          onPointerDown={onScenePointerDown}
          onPointerMove={onScenePointerMove}
          onObjectSelect={onObjectSelect}
        />
        <StreetDesignInspectorView
          selectedObject={selectedObject}
          readOnly={readOnly}
          onPropertyChange={onPropertyChange}
          onWidthChange={onWidthChange}
          onUnitCostChange={onUnitCostChange}
          onDeleteObject={onDeleteObject}
        />
      </div>

      <StreetCostSummaryView summary={costSummary} />
    </main>
  );
}
