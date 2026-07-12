import { CircleHelp } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { OnlineCollaboratorAvatars } from '@/features/editor/ui/OnlineCollaboratorAvatars';
import type { EditorCollaborator, EditorPresencePeer } from '@/features/editor/types';
import { PageSkeleton } from '@/features/shared/ui/feedback';
import { NotFound } from '@/features/shared/ui/ui/not-found';
import { type SelectableEditingMode } from '@/features/shared/ui/status';
import { Popover, PopoverAnchor, PopoverContent } from '@/features/shared/ui/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignOsmFeatures } from '../logic/streetDesignOsm';
import type {
  StreetDesignChangeRequest,
  StreetDesignChangeRequestColorMode,
} from '../logic/streetDesignChangeRequests';
import type {
  CorridorGeometry,
  PathCorridorGeometry,
  StreetDesignBoundingBox,
  StreetDesignComparisonLayer,
  StreetDesignCostLine,
  StreetDesignCostSummary,
  StreetDesignGeoPoint,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignMapSelection,
  StreetDesignSelectionAddress,
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
import { StreetDesignWorkspaceView } from './StreetDesignWorkspaceView';
import type { StreetDesignDiscussionLike } from './StreetDesignChangeRequestPanel';
import type { StreetDesignRemoteCursor } from '../hooks/useStreetDesignRemoteCursors';

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
  canEditMapContext: boolean;
  mode: SelectableEditingMode;
  modeDisabledReasons: Partial<Record<SelectableEditingMode, string>>;
  canChangeMode: boolean;
  canVoteOnStreetChangeRequests: boolean;
  canFinalizeStreetChangeRequests?: boolean;
  currentUserId?: string;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
  collaborationDocumentId?: string | null;
  editorCollaborators: EditorCollaborator[];
  existingCollaboratorIds: string[];
  onlinePeerMap: Map<string, EditorPresencePeer>;
  activeCursorUserIds: Set<string>;
  presenceColorByUserId: Map<string, string>;
  remoteCursors: readonly StreetDesignRemoteCursor[];
  streetChangeRequests: readonly StreetDesignChangeRequest[];
  streetDesignDiscussions?: readonly StreetDesignDiscussionLike[];
  changeRequestColorMode?: StreetDesignChangeRequestColorMode;
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
  selectionAddress?: StreetDesignSelectionAddress;
  selectionAddressLabel: string;
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
  onSelectionAddressChange: (address?: StreetDesignSelectionAddress) => void;
  onLoadOsm: () => void;
  onSave: () => void;
  onModeChange: (mode: SelectableEditingMode) => void | Promise<void>;
  onChangeRequestVote: (
    changeRequestId: string,
    vote: 'accept' | 'reject' | 'abstain'
  ) => void | Promise<void>;
  onChangeRequestFinalize?: (changeRequestId: string) => void | Promise<void>;
  onChangeRequestTitleChange?: (changeRequestId: string, title: string) => void | Promise<void>;
  onChangeRequestCommentSubmit?: (changeRequestId: string, text: string) => void | Promise<void>;
  onChangeRequestColorModeChange?: (mode: StreetDesignChangeRequestColorMode) => void;
  onToolChange: (
    type: StreetDesignObjectType,
    propertyOverrides?: Record<string, StreetDesignPropertyValue>,
    widthOverride?: number
  ) => void;
  onInteractionModeChange: (mode: StreetDesignInteractionMode) => void;
  onComparisonModeChange: (mode: StreetDesignStateV1['comparisonMode']) => void;
  onScenePointerDown: (point: StreetDesignLocalPoint) => void;
  onScenePointerMove: (point: StreetDesignLocalPoint) => void;
  onScenePointerHover: (
    point: StreetDesignLocalPoint | null,
    layer: StreetDesignComparisonLayer
  ) => void;
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
  onOsmWayImport?: (osmWayId: string) => void;
  onOsmImportUndo?: (osmWayId: string) => void;
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
  canEditMapContext,
  mode,
  modeDisabledReasons,
  canChangeMode,
  canVoteOnStreetChangeRequests,
  canFinalizeStreetChangeRequests = false,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  collaborationDocumentId,
  editorCollaborators,
  existingCollaboratorIds,
  onlinePeerMap,
  activeCursorUserIds,
  presenceColorByUserId,
  remoteCursors,
  streetChangeRequests,
  streetDesignDiscussions = [],
  changeRequestColorMode = 'natural',
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
  selectionAddress,
  selectionAddressLabel,
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
  onSelectionAddressChange,
  onLoadOsm,
  onSave,
  onModeChange,
  onChangeRequestVote,
  onChangeRequestFinalize,
  onChangeRequestTitleChange,
  onChangeRequestCommentSubmit,
  onChangeRequestColorModeChange = () => undefined,
  onToolChange,
  onInteractionModeChange,
  onComparisonModeChange,
  onScenePointerDown,
  onScenePointerMove,
  onScenePointerHover,
  onFinishPlacement,
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onObjectVisibilityChange,
  onObjectCategoryVisibilityChange,
  onOsmWayHide,
  onOsmWayImport = () => undefined,
  onOsmImportUndo = () => undefined,
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
  const [pendingCategoryDeletion, setPendingCategoryDeletion] =
    useState<StreetDesignObjectCategory | null>(null);
  const osmWayCount = useMemo(
    () => getStreetDesignOsmFeatures(design.osmSnapshot).length,
    [design.osmSnapshot]
  );
  const title = amendment?.title ?? t('features.amendments.streetscape.defaultTitle');
  const pendingCategoryDeletionCount = pendingCategoryDeletion
    ? design.objects.filter(
        object => getStreetDesignObjectDefinition(object.type).category === pendingCategoryDeletion
      ).length
    : 0;
  const handleObjectCategoryDelete = useCallback(
    (category: StreetDesignObjectCategory) => {
      if (mode === 'suggest_internal' || mode === 'suggest_event') {
        setPendingCategoryDeletion(category);
        return;
      }
      onDeleteObjectCategory(category);
    },
    [mode, onDeleteObjectCategory]
  );
  const confirmObjectCategoryDelete = useCallback(() => {
    if (!pendingCategoryDeletion) return;
    onDeleteObjectCategory(pendingCategoryDeletion);
    setPendingCategoryDeletion(null);
  }, [onDeleteObjectCategory, pendingCategoryDeletion]);
  const kpis = useMemo(
    () => [
      t('features.amendments.streetscape.metrics.elements', { count: design.objects.length }),
      t('features.amendments.streetscape.metrics.cost', {
        cost: formatMinorCurrency(costSummary.totalCostMinor, costSummary.currency),
      }),
      t('features.amendments.streetscape.metrics.changeRequests', {
        count: streetChangeRequests.length,
      }),
    ],
    [
      costSummary.currency,
      costSummary.totalCostMinor,
      design.objects.length,
      streetChangeRequests.length,
      t,
    ]
  );
  const selectObject = useCallback(
    (objectId: string | null) => {
      setSelectedChangeRequestId(null);
      onObjectSelect(objectId);
    },
    [onObjectSelect]
  );
  const selectOsmWay = useCallback(
    (osmWayId: string | null) => {
      setSelectedChangeRequestId(null);
      onOsmWaySelect(osmWayId);
    },
    [onOsmWaySelect]
  );
  const selectChangeRequest = useCallback(
    (changeRequestId: string | null) => {
      setSelectedChangeRequestId(changeRequestId);
      if (changeRequestId) {
        setShowChangeRequests(true);
        onObjectSelect(null);
        onOsmWaySelect(null);
      }
    },
    [onObjectSelect, onOsmWaySelect]
  );
  const handleAreaPickerLoadOsm = useCallback(() => {
    setAreaPickerOpen(false);
    onLoadOsm();
  }, [onLoadOsm]);

  const areaPickerContent = useMemo(
    () => (
      <StreetAreaPicker
        center={selectedCenter}
        bbox={selectedBbox}
        mapSelection={selectedMapSelection}
        isLoadingOsm={isLoadingOsm}
        osmError={osmError}
        readOnly={!canEditMapContext}
        selectionAddress={selectionAddress}
        addressLabel={selectionAddressLabel}
        open
        onOpenChange={setAreaPickerOpen}
        variant="panel"
        onMapSelectionChange={onSelectedMapSelectionChange}
        onSelectionAddressChange={onSelectionAddressChange}
        onLoadOsm={handleAreaPickerLoadOsm}
      />
    ),
    [
      handleAreaPickerLoadOsm,
      isLoadingOsm,
      onSelectedMapSelectionChange,
      onSelectionAddressChange,
      osmError,
      canEditMapContext,
      selectionAddress,
      selectionAddressLabel,
      selectedBbox,
      selectedCenter,
      selectedMapSelection,
    ]
  );
  const costSummaryContent = useMemo(
    () => (
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
        onDeleteObjectCategory={handleObjectCategoryDelete}
      />
    ),
    [
      costSummary,
      design.comparisonMode,
      onComparisonModeChange,
      onDeleteObject,
      handleObjectCategoryDelete,
      readOnly,
      selectObject,
      selectedObjectId,
    ]
  );

  if (isLoading) {
    return <PageSkeleton variant="settings" />;
  }

  if (!amendment) {
    return <NotFound />;
  }

  return (
    <div className="space-y-2 pt-5">
      <StreetDesignTopBarView
        readOnly={readOnly}
        mapContextReadOnly={!canEditMapContext}
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
        onObjectCategoryDelete={handleObjectCategoryDelete}
        onOsmLayerVisibilityChange={onOsmLayerVisibilityChange}
        onShowStreetMarkingsChange={onShowStreetMarkingsChange}
        onComparisonModeChange={onComparisonModeChange}
        onAreaPickerOpenChange={setAreaPickerOpen}
        onCostSummaryOpenChange={setCostSummaryOpen}
        onLoadOsm={onLoadOsm}
        onOsmWayHide={onOsmWayHide}
      />

      <AlertDialog
        open={pendingCategoryDeletion != null}
        onOpenChange={open => {
          if (!open) setPendingCategoryDeletion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('features.amendments.streetscape.categoryDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('features.amendments.streetscape.categoryDelete.description', {
                count: pendingCategoryDeletionCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('features.amendments.streetscape.categoryDelete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmObjectCategoryDelete}>
              {t('features.amendments.streetscape.categoryDelete.confirm', {
                count: pendingCategoryDeletionCount,
              })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          changeRequestColorMode={changeRequestColorMode}
          onShowChangeRequestsChange={setShowChangeRequests}
          onChangeRequestColorModeChange={onChangeRequestColorModeChange}
          onChangeRequestSelect={selectChangeRequest}
        />

        <StreetDesignWorkspaceView
          contentOnly
          beforeCard
          title={title}
          selectionAddressLabel={selectionAddressLabel}
          metricLabels={[
            t('features.amendments.streetscape.metrics.existing', { count: osmWayCount }),
            ...kpis,
          ]}
          isDirty={isDirty}
          collaborators={
            <OnlineCollaboratorAvatars
              collaborators={editorCollaborators}
              onlinePeerMap={onlinePeerMap}
              activeCursorUserIds={activeCursorUserIds}
              currentUserId={currentUserId}
              presenceColorByUserId={presenceColorByUserId}
              enabled
            />
          }
          headerActions={<StreetDesignNavigationHelp />}
        >
          <StreetSceneCanvasView
            design={design}
            initialLegendOpen={false}
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
            mapContextReadOnly={!canEditMapContext}
            changeRequests={streetChangeRequests}
            streetDesignDiscussions={streetDesignDiscussions}
            selectedChangeRequestId={selectedChangeRequestId}
            showChangeRequests={showChangeRequests}
            changeRequestColorMode={changeRequestColorMode}
            canVoteOnChangeRequests={canVoteOnStreetChangeRequests}
            canFinalizeChangeRequests={canFinalizeStreetChangeRequests}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            collaborators={editorCollaborators}
            remoteCursors={remoteCursors}
            onPointerDown={onScenePointerDown}
            onPointerMove={onScenePointerMove}
            onPointerHover={onScenePointerHover}
            onFinishPlacement={onFinishPlacement}
            onFinishPathPlacement={onFinishPathPlacement}
            onCancelPlacement={onCancelPlacement}
            onObjectSelect={selectObject}
            onOsmWaySelect={selectOsmWay}
            onObjectVisibilityChange={onObjectVisibilityChange}
            onOsmWayHide={onOsmWayHide}
            onOsmWayImport={onOsmWayImport}
            onOsmImportUndo={onOsmImportUndo}
            onObjectRotate={onRotationChange}
            onPropertyChange={onPropertyChange}
            onWidthChange={onWidthChange}
            onRotationChange={onRotationChange}
            onUnitCostChange={onUnitCostChange}
            onDeleteObject={onDeleteObject}
            onChangeRequestSelect={selectChangeRequest}
            onChangeRequestVote={onChangeRequestVote}
            onChangeRequestFinalize={onChangeRequestFinalize}
            onChangeRequestTitleChange={onChangeRequestTitleChange}
            onChangeRequestCommentSubmit={onChangeRequestCommentSubmit}
          />
        </StreetDesignWorkspaceView>
      </div>
    </div>
  );
}

function StreetDesignNavigationHelp() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const helpTabs = [
    {
      key: 'touch',
      label: t('features.amendments.streetscape.help.tabs.touch'),
      sections: [
        {
          key: 'select',
          title: t('features.amendments.streetscape.help.modes.select'),
          items: [t('features.amendments.streetscape.help.touch.select')],
        },
        {
          key: 'place',
          title: t('features.amendments.streetscape.help.modes.place'),
          items: [t('features.amendments.streetscape.help.touch.place')],
        },
        {
          key: 'camera',
          title: t('features.amendments.streetscape.help.modes.camera'),
          items: [t('features.amendments.streetscape.help.touch.camera')],
        },
      ],
      globalItems: [t('features.amendments.streetscape.help.touch.global')],
    },
    {
      key: 'mouse',
      label: t('features.amendments.streetscape.help.tabs.mouse'),
      sections: [
        {
          key: 'select',
          title: t('features.amendments.streetscape.help.modes.select'),
          items: [
            t('features.amendments.streetscape.help.mouse.select'),
            t('features.amendments.streetscape.help.mouse.rotate'),
          ],
        },
        {
          key: 'place',
          title: t('features.amendments.streetscape.help.modes.place'),
          items: [t('features.amendments.streetscape.help.mouse.place')],
        },
        {
          key: 'camera',
          title: t('features.amendments.streetscape.help.modes.camera'),
          items: [t('features.amendments.streetscape.help.mouse.camera')],
        },
      ],
      globalItems: [t('features.amendments.streetscape.help.mouse.global')],
    },
    {
      key: 'keyboard',
      label: t('features.amendments.streetscape.help.tabs.keyboard'),
      sections: [
        {
          key: 'select',
          title: t('features.amendments.streetscape.help.modes.select'),
          items: [t('features.amendments.streetscape.help.keyboard.select')],
        },
        {
          key: 'place',
          title: t('features.amendments.streetscape.help.modes.place'),
          items: [t('features.amendments.streetscape.help.keyboard.place')],
        },
        {
          key: 'camera',
          title: t('features.amendments.streetscape.help.modes.camera'),
          items: [t('features.amendments.streetscape.help.keyboard.camera')],
        },
      ],
      globalItems: [t('features.amendments.streetscape.help.keyboard.global')],
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-label={t('features.amendments.streetscape.help.trigger')}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="bg-muted/20 hover:bg-muted/40 focus-visible:ring-ring text-muted-foreground hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
          onClick={() => setOpen(current => !current)}
          onFocus={() => setOpen(true)}
          onMouseEnter={() => setOpen(true)}
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-[min(34rem,calc(100vw-2rem))] p-0">
        <div className="space-y-4 p-4 text-sm">
          <div className="space-y-1">
            <h3 className="font-semibold">{t('features.amendments.streetscape.help.title')}</h3>
            <p className="text-muted-foreground text-xs">
              {t('features.amendments.streetscape.help.description')}
            </p>
          </div>

          <Tabs defaultValue="touch">
            <TabsList className="w-full">
              {helpTabs.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex-1">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {helpTabs.map(tab => (
              <TabsContent key={tab.key} value={tab.key} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {tab.sections.map(section => (
                    <section key={section.key} className="space-y-2">
                      <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                        {section.title}
                      </h4>
                      <ul className="space-y-1.5 text-xs leading-relaxed">
                        {section.items.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                <section className="bg-muted/20 rounded-md border p-3">
                  <h4 className="text-muted-foreground text-xs font-semibold uppercase">
                    {t('features.amendments.streetscape.help.global.title')}
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
                    {tab.globalItems.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
