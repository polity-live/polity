import { MapPinned } from 'lucide-react';
import { useState } from 'react';
import { OnlineCollaboratorAvatars } from '@/features/editor/ui/OnlineCollaboratorAvatars';
import type { EditorCollaborator, EditorPresencePeer } from '@/features/editor/types';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { type SelectableEditingMode } from '@/features/shared/ui/status';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignOsmFeatures } from '../logic/streetDesignOsm';
import type { StreetDesignChangeRequest } from '../logic/streetDesignChangeRequests';
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
import {
  StreetDesignSecondaryActionBarView,
  StreetDesignTopBarView,
} from './StreetDesignTopBarView';
import { StreetSceneCanvasView } from './StreetSceneCanvasView';

type StreetDesignAmendmentSummary =
  | {
      title?: string | null;
    }
  | null
  | undefined;

interface StreetDesignPageViewProps {
  amendmentId: string;
  amendment: StreetDesignAmendmentSummary;
  isLoading: boolean;
  readOnly: boolean;
  mode: SelectableEditingMode;
  modeDisabledReasons: Partial<Record<SelectableEditingMode, string>>;
  canChangeMode: boolean;
  currentUserId?: string;
  collaborationDocumentId?: string | null;
  editorCollaborators: EditorCollaborator[];
  existingCollaboratorIds: string[];
  onlinePeerMap: Map<string, EditorPresencePeer>;
  activeCursorUserIds: Set<string>;
  presenceColorByUserId: Map<string, string>;
  streetChangeRequests: readonly StreetDesignChangeRequest[];
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
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
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
  amendmentId,
  amendment,
  isLoading,
  readOnly,
  mode,
  modeDisabledReasons,
  canChangeMode,
  currentUserId,
  collaborationDocumentId,
  editorCollaborators,
  existingCollaboratorIds,
  onlinePeerMap,
  activeCursorUserIds,
  presenceColorByUserId,
  streetChangeRequests,
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
  onModeChange,
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
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onDeleteObjectCategory,
}: StreetDesignPageViewProps) {
  const { t } = useTranslation();
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [costSummaryOpen, setCostSummaryOpen] = useState(false);
  const [showChangeRequests, setShowChangeRequests] = useState(true);
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(null);

  if (isLoading) {
    return <PageSkeleton variant="settings" />;
  }

  if (!amendment) {
    return <NotFound />;
  }

  const osmWayCount = getStreetDesignOsmFeatures(design.osmSnapshot).length;
  const title = amendment.title ?? t('features.amendments.streetscape.defaultTitle');
  const kpis = [
    t('features.amendments.streetscape.metrics.elements', { count: design.objects.length }),
    t('features.amendments.streetscape.metrics.cost', {
      cost: formatMinorCurrency(costSummary.totalCostMinor, costSummary.currency),
    }),
    t('features.amendments.streetscape.metrics.changeRequests', {
      count: streetChangeRequests.length,
    }),
  ];
  const selectObject = (objectId: string | null) => {
    setSelectedChangeRequestId(null);
    onObjectSelect(objectId);
  };
  const selectOsmWay = (osmWayId: string | null) => {
    setSelectedChangeRequestId(null);
    onOsmWaySelect(osmWayId);
  };
  const selectChangeRequest = (changeRequestId: string | null) => {
    setSelectedChangeRequestId(changeRequestId);
    if (changeRequestId) {
      setShowChangeRequests(true);
      onObjectSelect(null);
      onOsmWaySelect(null);
    }
  };

  const areaPickerContent = (
    <StreetAreaPicker
      center={selectedCenter}
      bbox={selectedBbox}
      mapSelection={selectedMapSelection}
      isLoadingOsm={isLoadingOsm}
      osmError={osmError}
      readOnly={readOnly}
      open
      onOpenChange={setAreaPickerOpen}
      variant="panel"
      onMapSelectionChange={onSelectedMapSelectionChange}
      onLoadOsm={onLoadOsm}
      onLoadSample={onLoadSample}
    />
  );
  const costSummaryContent = (
    <StreetCostSummaryView
      summary={costSummary}
      comparisonMode={design.comparisonMode}
      selectedObjectId={selectedObjectId}
      readOnly={readOnly}
      showComparisonControls={false}
      variant="panel"
      onComparisonModeChange={onComparisonModeChange}
      onObjectSelect={selectObject}
      onDeleteObject={onDeleteObject}
      onDeleteObjectCategory={onDeleteObjectCategory}
    />
  );

  return (
    <div className="space-y-2 pt-5">
      <StreetDesignTopBarView
        readOnly={readOnly}
        mode={mode}
        modeDisabledReasons={modeDisabledReasons}
        canChangeMode={canChangeMode}
        isDirty={isDirty}
        isSaving={isSaving}
        saveError={saveError}
        selectedTool={selectedTool}
        selectedToolProperties={placementSettings.properties}
        interactionMode={interactionMode}
        objects={design.objects}
        selectedObjectId={selectedObjectId}
        selectedOsmWay={selectedOsmWay}
        hiddenObjectIds={hiddenObjectIds}
        hiddenObjectCategories={hiddenObjectCategories}
        osmLayerVisibility={osmLayerVisibility}
        showStreetMarkings={showStreetMarkings}
        comparisonMode={design.comparisonMode}
        costSummary={costSummary}
        areaPickerOpen={areaPickerOpen}
        costSummaryOpen={costSummaryOpen}
        isLoadingOsm={isLoadingOsm}
        osmError={osmError}
        areaPickerContent={areaPickerContent}
        costSummaryContent={costSummaryContent}
        onModeChange={onModeChange}
        onSave={onSave}
        onToolChange={onToolChange}
        onInteractionModeChange={onInteractionModeChange}
        onObjectSelect={selectObject}
        onObjectVisibilityChange={onObjectVisibilityChange}
        onObjectCategoryVisibilityChange={onObjectCategoryVisibilityChange}
        onObjectDelete={onDeleteObject}
        onObjectCategoryDelete={onDeleteObjectCategory}
        onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
        onShowStreetMarkingsChange={onShowStreetMarkingsChange}
        onComparisonModeChange={onComparisonModeChange}
        onAreaPickerOpenChange={setAreaPickerOpen}
        onCostSummaryOpenChange={setCostSummaryOpen}
        onLoadOsm={onLoadOsm}
        onLoadSample={onLoadSample}
        onOsmWayHide={onOsmWayHide}
      />

      <div className="container mx-auto px-8 pt-8 pb-8">
        <StreetDesignSecondaryActionBarView
          amendmentId={amendmentId}
          title={title}
          readOnly={readOnly}
          currentUserId={currentUserId}
          collaborationDocumentId={collaborationDocumentId}
          existingCollaboratorIds={existingCollaboratorIds}
          changeRequests={streetChangeRequests}
          selectedChangeRequestId={selectedChangeRequestId}
          showChangeRequests={showChangeRequests}
          onShowChangeRequestsChange={setShowChangeRequests}
          onChangeRequestSelect={selectChangeRequest}
        />

        <Card className="mt-4 overflow-hidden rounded-lg p-0">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-muted/40 flex size-10 shrink-0 items-center justify-center rounded-md border">
                <MapPinned className="text-muted-foreground size-5" />
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <CardTitle size="lg" className="truncate leading-tight">
                  {title}
                </CardTitle>
                <OnlineCollaboratorAvatars
                  collaborators={editorCollaborators}
                  onlinePeerMap={onlinePeerMap}
                  activeCursorUserIds={activeCursorUserIds}
                  currentUserId={currentUserId}
                  presenceColorByUserId={presenceColorByUserId}
                  enabled
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs">
              <span className="bg-muted/20 rounded-md border px-3 py-2 font-medium whitespace-nowrap">
                {t('features.amendments.streetscape.metrics.existing', { count: osmWayCount })}
              </span>
              {kpis.map(label => (
                <span
                  key={label}
                  className="bg-muted/20 rounded-md border px-3 py-2 font-medium whitespace-nowrap"
                >
                  {label}
                </span>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <StreetSceneCanvasView
              design={design}
              isLoadingOsm={isLoadingOsm}
              placementPreview={placementPreview}
              placementPreviewType={placementPreviewType}
              placementStart={placementStart}
              placementMode={placementMode}
              placementPointCount={placementPointCount}
              canFinishPathPlacement={canFinishPathPlacement}
              selectedObjectId={selectedObjectId}
              selectedObject={selectedObject}
              selectedObjectCostLine={selectedObjectCostLine}
              selectedObjectFocusRequestKey={selectedObjectFocusRequestKey}
              hiddenObjectIds={hiddenObjectIds}
              hiddenObjectCategories={hiddenObjectCategories}
              selectedOsmWayId={selectedOsmWay?.id ?? null}
              selectedOsmWay={selectedOsmWay}
              selectedOsmFocusRequestKey={selectedOsmFocusRequestKey}
              interactionMode={interactionMode}
              readOnly={readOnly}
              changeRequests={streetChangeRequests}
              selectedChangeRequestId={selectedChangeRequestId}
              showChangeRequests={showChangeRequests}
              onPointerDown={onScenePointerDown}
              onPointerMove={onScenePointerMove}
              onFinishPlacement={onFinishPlacement}
              onFinishPathPlacement={onFinishPathPlacement}
              onCancelPlacement={onCancelPlacement}
              onObjectSelect={selectObject}
              onOsmWaySelect={selectOsmWay}
              onObjectVisibilityChange={onObjectVisibilityChange}
              onOsmWayHide={onOsmWayHide}
              onObjectRotate={onRotationChange}
              onPropertyChange={onPropertyChange}
              onWidthChange={onWidthChange}
              onRotationChange={onRotationChange}
              onUnitCostChange={onUnitCostChange}
              onDeleteObject={onDeleteObject}
              onChangeRequestSelect={selectChangeRequest}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
