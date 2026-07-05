import { Save } from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { BadgeControl } from '@/features/shared/ui/status';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
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
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmLayerVisibility,
  StreetDesignOsmWay,
  StreetDesignPlacementSettings,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import { StreetAreaPicker } from './StreetAreaPicker';
import { StreetCostSummaryView } from './StreetCostSummaryView';
import { StreetDesignInspectorView } from './StreetDesignInspectorView';
import { StreetDesignToolbarView } from './StreetDesignToolbarView';
import { StreetSceneCanvasView } from './StreetSceneCanvasView';
import { getStreetDesignOsmFeatures } from '../logic/streetDesignOsm';

type StreetDesignAmendmentSummary = { title?: string | null } | null | undefined;

interface StreetDesignPageViewProps {
  amendment: StreetDesignAmendmentSummary;
  isLoading: boolean;
  readOnly: boolean;
  design: StreetDesignStateV1;
  selectedObject: StreetDesignObject | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  selectedObjectCostLine: StreetDesignCostLine | null;
  selectedObjectId: string | null;
  selectedObjectFocusRequestKey: number;
  selectedOsmFocusRequestKey: number;
  hiddenObjectIds: string[];
  hiddenObjectCategories: StreetDesignObjectCategory[];
  selectedTool: StreetDesignObjectType;
  interactionMode: StreetDesignInteractionMode;
  placementSettings: StreetDesignPlacementSettings;
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
  onToolChange: (
    type: StreetDesignObjectType,
    propertyOverrides?: Record<string, StreetDesignPropertyValue>,
    widthOverride?: number
  ) => void;
  onInteractionModeChange: (mode: StreetDesignInteractionMode) => void;
  onComparisonModeChange: (mode: StreetDesignStateV1['comparisonMode']) => void;
  onScenePointerDown: (point: StreetDesignLocalPoint) => void;
  onScenePointerMove: (point: StreetDesignLocalPoint) => void;
  onFinishPlacement: () => void;
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onObjectCategoryVisibilityChange: (
    category: StreetDesignObjectCategory,
    visible: boolean
  ) => void;
  onOsmWayHide: (osmWayId: string) => void;
  onOsmLayerVisibilityChange: (
    layer: keyof StreetDesignOsmLayerVisibility,
    visible: boolean
  ) => void;
  onShowStreetMarkingsChange: (visible: boolean) => void;
  onPlacementPropertyChange: (key: string, value: StreetDesignPropertyValue) => void;
  onPlacementWidthChange: (width: number) => void;
  onPlacementRotationChange: (rotationDeg: number) => void;
  onPlacementUnitCostChange: (unitCostMinor: number | null) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onDeleteObjectCategory: (category: StreetDesignObjectCategory) => void;
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
  selectedObjectFocusRequestKey,
  selectedOsmFocusRequestKey,
  hiddenObjectIds,
  hiddenObjectCategories,
  selectedTool,
  interactionMode,
  placementSettings,
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
  onObjectVisibilityChange,
  onObjectCategoryVisibilityChange,
  onOsmWayHide,
  onOsmLayerVisibilityChange,
  onShowStreetMarkingsChange,
  onPlacementPropertyChange,
  onPlacementWidthChange,
  onPlacementRotationChange,
  onPlacementUnitCostChange,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onDeleteObjectCategory,
}: StreetDesignPageViewProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <PageSkeleton variant="settings" />;
  }

  if (!amendment) {
    return <NotFound />;
  }

  const osmWayCount = getStreetDesignOsmFeatures(design.osmSnapshot).length;
  const metricLabels = [
    t('features.amendments.streetscape.metrics.elements', { count: design.objects.length }),
    t('features.amendments.streetscape.metrics.existing', { count: osmWayCount }),
    t('features.amendments.streetscape.metrics.cost', {
      cost: formatMinorCurrency(costSummary.totalCostMinor, costSummary.currency),
    }),
  ];
  const comparisonLabel = t(
    `features.amendments.streetscape.comparison.${
      design.comparisonMode === 'new_design' ? 'newDesign' : design.comparisonMode
    }`
  );

  return (
    <main className="flex w-full flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <header className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeControl variant="outline">
                {t('features.amendments.streetscape.badge')}
              </BadgeControl>
              <BadgeControl variant={readOnly ? 'secondary' : isDirty ? 'outline' : 'secondary'}>
                {readOnly
                  ? t('features.amendments.streetscape.status.readOnly')
                  : isDirty
                    ? t('features.amendments.streetscape.status.unsaved')
                    : t('features.amendments.streetscape.status.saved')}
              </BadgeControl>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t('features.amendments.streetscape.amendmentLabel')}
              </p>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight">
                {amendment.title ?? t('features.amendments.streetscape.defaultTitle')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {saveError ? <span className="text-destructive text-xs">{saveError}</span> : null}
            <Button type="button" onClick={onSave} disabled={readOnly || isSaving || !isDirty}>
              <Save className="size-4" />
              {isSaving
                ? t('features.amendments.streetscape.saving')
                : t('features.amendments.streetscape.save')}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-3 sm:px-5">
          {metricLabels.map(label => (
            <div key={label} className="bg-muted/20 rounded-md border px-3 py-2 font-medium">
              {label}
            </div>
          ))}
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

      <section className="bg-card overflow-hidden rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {t('features.amendments.streetscape.workspaceTitle')}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t('features.amendments.streetscape.workspaceDescription')}
            </p>
          </div>
          <BadgeControl variant="outline">{comparisonLabel}</BadgeControl>
        </div>

        <div className="grid gap-0 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <StreetDesignToolbarView
            selectedTool={selectedTool}
            selectedToolProperties={placementSettings.properties}
            interactionMode={interactionMode}
            objects={design.objects}
            selectedObjectId={selectedObjectId}
            hiddenObjectIds={hiddenObjectIds}
            hiddenObjectCategories={hiddenObjectCategories}
            osmLayerVisibility={osmLayerVisibility}
            showStreetMarkings={showStreetMarkings}
            readOnly={readOnly}
            onToolChange={onToolChange}
            onInteractionModeChange={onInteractionModeChange}
            onObjectSelect={onObjectSelect}
            onObjectVisibilityChange={onObjectVisibilityChange}
            onObjectCategoryVisibilityChange={onObjectCategoryVisibilityChange}
            onObjectDelete={onDeleteObject}
            onObjectCategoryDelete={onDeleteObjectCategory}
            onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
            onShowStreetMarkingsChange={onShowStreetMarkingsChange}
          />
          <StreetSceneCanvasView
            design={design}
            metricLabels={metricLabels}
            isLoadingOsm={isLoadingOsm}
            placementPreview={placementPreview}
            placementPreviewType={placementPreviewType}
            placementStart={placementStart}
            placementMode={placementMode}
            placementPointCount={placementPointCount}
            canFinishPathPlacement={canFinishPathPlacement}
            selectedObjectId={selectedObjectId}
            selectedObject={selectedObject}
            selectedObjectFocusRequestKey={selectedObjectFocusRequestKey}
            hiddenObjectIds={hiddenObjectIds}
            hiddenObjectCategories={hiddenObjectCategories}
            selectedOsmWayId={selectedOsmWay?.id ?? null}
            selectedOsmFocusRequestKey={selectedOsmFocusRequestKey}
            interactionMode={interactionMode}
            readOnly={readOnly}
            onPointerDown={onScenePointerDown}
            onPointerMove={onScenePointerMove}
            onFinishPlacement={onFinishPlacement}
            onFinishPathPlacement={onFinishPathPlacement}
            onCancelPlacement={onCancelPlacement}
            onObjectSelect={onObjectSelect}
            onOsmWaySelect={onOsmWaySelect}
            onObjectRotate={onRotationChange}
            onDeleteObject={onDeleteObject}
          />
          <StreetDesignInspectorView
            selectedObject={selectedObject}
            selectedOsmWay={selectedOsmWay}
            selectedObjectCostLine={selectedObjectCostLine}
            selectedTool={selectedTool}
            interactionMode={interactionMode}
            placementSettings={placementSettings}
            placementPreview={placementPreview}
            placementMode={placementMode}
            readOnly={readOnly}
            onPlacementPropertyChange={onPlacementPropertyChange}
            onPlacementWidthChange={onPlacementWidthChange}
            onPlacementRotationChange={onPlacementRotationChange}
            onPlacementUnitCostChange={onPlacementUnitCostChange}
            onPropertyChange={onPropertyChange}
            onWidthChange={onWidthChange}
            onRotationChange={onRotationChange}
            onUnitCostChange={onUnitCostChange}
            onDeleteObject={onDeleteObject}
            onHideOsmWay={onOsmWayHide}
          />
        </div>

        <StreetCostSummaryView
          summary={costSummary}
          comparisonMode={design.comparisonMode}
          selectedObjectId={selectedObjectId}
          readOnly={readOnly}
          onComparisonModeChange={onComparisonModeChange}
          onObjectSelect={onObjectSelect}
          onDeleteObject={onDeleteObject}
          onDeleteObjectCategory={onDeleteObjectCategory}
        />
      </section>
    </main>
  );
}
