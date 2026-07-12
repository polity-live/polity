'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { OverlayPortalBoundary } from '@/features/shared/ui/ui/overlay-portal-boundary';
import { StreetAreaPicker } from '@/features/amendments/streetscape/ui/StreetAreaPicker';
import { StreetCostSummaryView } from '@/features/amendments/streetscape/ui/StreetCostSummaryView';
import { StreetDesignTopBarView } from '@/features/amendments/streetscape/ui/StreetDesignTopBarView';
import { StreetDesignWorkspaceView } from '@/features/amendments/streetscape/ui/StreetDesignWorkspaceView';
import { StreetSceneCanvasView } from '@/features/amendments/streetscape/ui/StreetSceneCanvasView';
import { useStreetDesignEditorState } from '@/features/amendments/streetscape/hooks/useStreetDesignEditorState';
import { createEmptyStreetDesignState } from '@/features/amendments/streetscape/state/streetDesignReducer';
import {
  createPathCorridorStreetDesignObject,
  createPointStreetDesignObject,
} from '@/features/amendments/streetscape/logic/streetDesignPlacement';
import { getStreetDesignMapSelectionBoundingBox } from '@/features/amendments/streetscape/logic/streetDesignBbox';
import {
  getStreetDesignOsmFeatures,
  getStreetDesignOsmLayerVisibility,
} from '@/features/amendments/streetscape/logic/streetDesignOsm';
import { formatStreetDesignSelectionAddress } from '@/features/amendments/streetscape/logic/streetDesignSelectionAddress';
import { formatMinorCurrency } from '@/features/amendments/streetscape/logic/streetDesignCostCatalog';
import { createStreetDesignChangeRequestPayloads } from '@/features/amendments/streetscape/logic/streetDesignChangeRequestDiff';
import type {
  StreetDesignChangeRequest,
  StreetDesignChangeRequestColorMode,
} from '@/features/amendments/streetscape/logic/streetDesignChangeRequests';
import type {
  StreetDesignCameraPose,
  StreetDesignMapSelection,
  StreetDesignSelectionAddress,
  StreetDesignStateV1,
} from '@/features/amendments/streetscape/types';
import type { SelectableEditingMode } from '@/features/shared/ui/status';
import { overpassStreetSceneFn } from '@/server/overpass-street-scene';

const demoModes = [
  'view',
  'edit',
  'suggest_internal',
  'vote_internal',
] as const satisfies readonly SelectableEditingMode[];

const landingStreetOrigin = {
  lat: 48.1142733,
  lon: 11.5325083,
  label: 'Euckenstraße 38, München',
};
const landingStreetCameraPose: StreetDesignCameraPose = {
  position: { x: 0, y: 118, z: 132 },
  target: { x: 0, y: 0, z: 0 },
};
const defaultLandingMapSelection: StreetDesignMapSelection = {
  center: { lat: landingStreetOrigin.lat, lon: landingStreetOrigin.lon },
  widthMeters: 160,
  heightMeters: 120,
  rotationDeg: 0,
};
const defaultLandingAddress: StreetDesignSelectionAddress = {
  formatted: landingStreetOrigin.label,
  city: 'München',
  postCode: '81369',
  region: 'Bayern',
  country: 'Deutschland',
  street: 'Euckenstraße',
  houseNumber: '38',
};

function createLandingInitialDesign(): StreetDesignStateV1 {
  const base = createEmptyStreetDesignState(landingStreetOrigin);
  return {
    ...base,
    mapSelection: defaultLandingMapSelection,
    selectionAddress: defaultLandingAddress,
    comparisonMode: 'overlay',
    objects: [
      createPathCorridorStreetDesignObject({
        id: 'landing-bike-lane',
        type: 'bike_lane',
        points: [
          { x: -42, z: 10 },
          { x: 0, z: 6 },
          { x: 42, z: 2 },
        ],
        width: 3,
      }),
      createPointStreetDesignObject({
        id: 'landing-tree',
        type: 'tree',
        point: { x: -22, z: -8 },
      }),
      createPointStreetDesignObject({
        id: 'landing-bank',
        type: 'bank',
        point: { x: 24, z: -7 },
      }),
    ],
  };
}

function createInitialChangeRequest(title: string): StreetDesignChangeRequest {
  const tree = createPointStreetDesignObject({
    id: 'landing-cr-tree',
    type: 'tree',
    point: { x: 18, z: -13 },
  });
  return {
    id: 'landing-street-cr-1',
    display_cr_id: 'CR-12',
    title,
    source_type: 'street_design_object',
    source_id: tree.id,
    change_type: 'insert',
    new_properties: tree,
    status: 'open',
    voting_status: 'open',
    votes_for: 12,
    votes_against: 2,
    votes_abstain: 0,
  };
}

export function LandingStreetDesignPreview() {
  const { t } = useTranslation();
  const initialDesign = useMemo(createLandingInitialDesign, []);
  const editor = useStreetDesignEditorState(initialDesign);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [baseDesign, setBaseDesign] = useState(initialDesign);
  const [mode, setMode] = useState<SelectableEditingMode>('edit');
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [costSummaryOpen, setCostSummaryOpen] = useState(false);
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showChangeRequests, setShowChangeRequests] = useState(true);
  const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(null);
  const changeRequestColorMode: StreetDesignChangeRequestColorMode = 'natural';
  const [changeRequests, setChangeRequests] = useState<StreetDesignChangeRequest[]>(() => [
    createInitialChangeRequest(
      t('pages.home.publicLanding.streetDesignPreview.changeRequestTitle')
    ),
  ]);
  const [voteByRequest, setVoteByRequest] = useState<
    Record<string, 'accept' | 'reject' | 'abstain'>
  >({});
  const initialLoadStarted = useRef(false);
  const loadRequestId = useRef(0);

  const readOnly = mode === 'view' || mode === 'vote_internal';
  const canEditMapContext = mode === 'edit';
  const selectedMapSelection = editor.design.mapSelection ?? defaultLandingMapSelection;
  const selectedCenter = selectedMapSelection.center;
  const selectedBbox = useMemo(
    () => getStreetDesignMapSelectionBoundingBox(selectedMapSelection),
    [selectedMapSelection]
  );
  const selectionAddressLabel = formatStreetDesignSelectionAddress(
    editor.design.selectionAddress,
    editor.design.origin.label,
    selectedCenter
  );
  const osmFeatures = getStreetDesignOsmFeatures(editor.design.osmSnapshot);
  const osmUsesFallback =
    osmFeatures.length > 0 && osmFeatures.every(feature => feature.source === 'fallback');
  const osmStatus = isLoadingOsm
    ? t('pages.home.publicLanding.streetDesignPreview.loadingOsm')
    : osmError
      ? t('pages.home.publicLanding.streetDesignPreview.osmUnavailable')
      : osmUsesFallback
        ? t('pages.home.publicLanding.streetDesignPreview.osmFallback')
        : t('pages.home.publicLanding.streetDesignPreview.osmLive');
  const placementDraft = editor.state.placementDraft;
  const placementPreview = placementDraft?.preview ?? null;
  const canFinishPathPlacement =
    placementDraft?.mode === 'path' && placementDraft.points.length >= 2;

  const loadOsm = useCallback(
    async ({ dirty, closePicker }: { dirty: boolean; closePicker: boolean }) => {
      const requestId = ++loadRequestId.current;
      setIsLoadingOsm(true);
      setOsmError(null);
      try {
        const snapshot = await overpassStreetSceneFn({ data: { bbox: selectedBbox } });
        if (requestId !== loadRequestId.current) return;
        const nextDesign: StreetDesignStateV1 = {
          ...editor.design,
          origin: {
            ...selectedCenter,
            label: selectionAddressLabel,
          },
          mapSelection: selectedMapSelection,
          osmSnapshot: snapshot,
          hiddenOsmWayIds: [],
          hiddenOsmFeatureIds: [],
          comparisonMode: 'overlay',
        };
        editor.replaceDesign(nextDesign, dirty);
        if (!dirty) setBaseDesign(nextDesign);
        if (closePicker) setAreaPickerOpen(false);
      } catch (error) {
        if (requestId !== loadRequestId.current) return;
        setOsmError(
          error instanceof Error
            ? error.message
            : t('pages.home.publicLanding.streetDesignPreview.osmError')
        );
      } finally {
        if (requestId === loadRequestId.current) setIsLoadingOsm(false);
      }
    },
    [editor, selectedBbox, selectedCenter, selectedMapSelection, selectionAddressLabel, t]
  );

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadOsm({ dirty: false, closePicker: false });
  }, [loadOsm]);

  const modeDisabledReasons = useMemo(() => {
    if (!editor.state.isDirty) return {};
    const reason = t('pages.home.publicLanding.streetDesignPreview.saveBeforeModeChange');
    return Object.fromEntries(
      demoModes.filter(nextMode => nextMode !== mode).map(nextMode => [nextMode, reason])
    ) as Partial<Record<SelectableEditingMode, string>>;
  }, [editor.state.isDirty, mode, t]);

  const handleModeChange = (nextMode: SelectableEditingMode) => {
    if (editor.state.isDirty || !demoModes.includes(nextMode as (typeof demoModes)[number])) return;
    setMode(nextMode);
    editor.setInteractionMode(
      nextMode === 'view' || nextMode === 'vote_internal' ? 'camera' : 'select'
    );
  };

  const handleSave = async () => {
    if (readOnly || !editor.state.isDirty) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await Promise.resolve();
      if (mode === 'suggest_internal') {
        const payloads = createStreetDesignChangeRequestPayloads({
          amendmentId: 'landing-demo-amendment',
          streetDesignId: 'landing-demo-street-design',
          baseDesign,
          draftDesign: editor.design,
        });
        const nextRequests: StreetDesignChangeRequest[] = payloads.map((payload, index) => ({
          ...payload,
          display_cr_id: `CR-${13 + changeRequests.length + index}`,
          title:
            payload.source_title ??
            t('pages.home.publicLanding.streetDesignPreview.localSuggestion'),
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
        }));
        if (nextRequests.length > 0) {
          setChangeRequests(current => [...current, ...nextRequests]);
          setSelectedChangeRequestId(nextRequests[0]?.id ?? null);
          setShowChangeRequests(true);
        }
        editor.replaceDesign(baseDesign, false);
      } else {
        setBaseDesign(editor.design);
        editor.replaceDesign(editor.design, false);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t('pages.home.publicLanding.streetDesignPreview.localSaveError')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeRequestVote = (
    changeRequestId: string,
    vote: 'accept' | 'reject' | 'abstain'
  ) => {
    if (mode !== 'vote_internal') return;
    const previousVote = voteByRequest[changeRequestId];
    setVoteByRequest(current => ({ ...current, [changeRequestId]: vote }));
    setChangeRequests(current =>
      current.map(request => {
        if (request.id !== changeRequestId) return request;
        const counts = {
          accept: request.votes_for ?? 0,
          reject: request.votes_against ?? 0,
          abstain: request.votes_abstain ?? 0,
        };
        if (previousVote) counts[previousVote] = Math.max(0, counts[previousVote] - 1);
        counts[vote] += 1;
        return {
          ...request,
          votes_for: counts.accept,
          votes_against: counts.reject,
          votes_abstain: counts.abstain,
          votes: [{ id: `landing-vote-${request.id}`, user_id: 'landing-demo-user', vote }],
        };
      })
    );
  };

  const areaPickerContent = (
    <StreetAreaPicker
      center={selectedCenter}
      bbox={selectedBbox}
      mapSelection={selectedMapSelection}
      isLoadingOsm={isLoadingOsm}
      osmError={osmError}
      readOnly={!canEditMapContext}
      selectionAddress={editor.design.selectionAddress}
      addressLabel={selectionAddressLabel}
      open
      variant="panel"
      onMapSelectionChange={selection => {
        if (!canEditMapContext) return;
        editor.updateMapContext(selection, undefined, true);
      }}
      onSelectionAddressChange={address => {
        if (canEditMapContext) editor.updateSelectionAddress(address);
      }}
      onLoadOsm={() => {
        setAreaPickerOpen(false);
        void loadOsm({ dirty: true, closePicker: false });
      }}
    />
  );

  const costSummaryContent = (
    <StreetCostSummaryView
      summary={editor.costSummary}
      comparisonMode={editor.design.comparisonMode}
      selectedObjectId={editor.state.selectedObjectId}
      readOnly={readOnly}
      showComparisonControls={false}
      variant="panel"
      onComparisonModeChange={editor.setComparisonMode}
      onObjectSelect={editor.selectObject}
      onDeleteObject={editor.deleteObject}
      onDeleteObjectCategory={editor.deleteObjectCategory}
    />
  );

  const metricLabels = [
    t('features.amendments.streetscape.metrics.existing', { count: osmFeatures.length }),
    t('features.amendments.streetscape.metrics.elements', {
      count: editor.design.objects.length,
    }),
    t('features.amendments.streetscape.metrics.cost', {
      cost: formatMinorCurrency(editor.costSummary.totalCostMinor, editor.costSummary.currency),
    }),
    t('features.amendments.streetscape.metrics.changeRequests', {
      count: changeRequests.length,
    }),
  ];

  const topBar = (
    <StreetDesignTopBarView
      positionMode="container"
      availableModes={demoModes}
      readOnly={readOnly}
      mapContextReadOnly={!canEditMapContext}
      mode={mode}
      modeDisabledReasons={modeDisabledReasons}
      canChangeMode
      isDirty={editor.state.isDirty}
      isSaving={isSaving}
      saveError={saveError}
      selectedTool={editor.state.selectedTool}
      selectedToolProperties={editor.placementSettings.properties}
      interactionMode={editor.interactionMode}
      objects={editor.design.objects}
      selectedObjectId={editor.state.selectedObjectId}
      selectedOsmWay={editor.selectedOsmWay}
      hiddenObjectIds={editor.state.hiddenObjectIds}
      hiddenObjectCategories={editor.state.hiddenObjectCategories}
      osmLayerVisibility={getStreetDesignOsmLayerVisibility(editor.design.osmLayerVisibility)}
      showStreetMarkings={editor.design.showStreetMarkings ?? true}
      comparisonMode={editor.design.comparisonMode}
      costSummary={editor.costSummary}
      areaPickerOpen={areaPickerOpen}
      costSummaryOpen={costSummaryOpen}
      isLoadingOsm={isLoadingOsm}
      osmError={osmError}
      areaPickerContent={areaPickerContent}
      costSummaryContent={costSummaryContent}
      onModeChange={handleModeChange}
      onSave={() => void handleSave()}
      onToolChange={editor.setSelectedTool}
      onInteractionModeChange={editor.setInteractionMode}
      onObjectSelect={editor.selectObject}
      onObjectVisibilityChange={editor.setObjectVisibility}
      onObjectCategoryVisibilityChange={editor.setObjectCategoryVisibility}
      onObjectDelete={editor.deleteObject}
      onObjectCategoryDelete={editor.deleteObjectCategory}
      onOsmLayerVisibilityChange={editor.setOsmLayerVisibility}
      onShowStreetMarkingsChange={editor.setShowStreetMarkings}
      onComparisonModeChange={editor.setComparisonMode}
      onAreaPickerOpenChange={setAreaPickerOpen}
      onCostSummaryOpenChange={setCostSummaryOpen}
      onLoadOsm={() => void loadOsm({ dirty: true, closePicker: false })}
      onOsmWayHide={editor.hideOsmWay}
    />
  );

  return (
    <div
      ref={setPortalContainer}
      className="landing-street-design-preview bg-background relative isolate h-[min(46rem,calc(100dvh-2rem))] min-h-[38rem] overflow-y-auto rounded-lg border shadow-sm"
      data-testid="landing-street-demo-window"
    >
      <OverlayPortalBoundary container={portalContainer}>
        <StreetDesignWorkspaceView
          embedded
          topBar={topBar}
          title={t('pages.home.publicLanding.streetDesignPreview.title')}
          selectionAddressLabel={`${selectionAddressLabel} · ${osmStatus}`}
          metricLabels={metricLabels}
          isDirty={editor.state.isDirty}
        >
          <StreetSceneCanvasView
            design={editor.design}
            embeddedWorkspace
            initialLegendOpen={false}
            initialCameraPose={landingStreetCameraPose}
            isLoadingOsm={isLoadingOsm}
            placementPreview={placementPreview}
            placementPreviewType={placementDraft?.type ?? null}
            placementStart={placementDraft?.start ?? null}
            placementMode={placementDraft?.mode ?? null}
            placementPointCount={placementDraft?.points.length ?? 0}
            canFinishPathPlacement={canFinishPathPlacement}
            selectedObjectId={editor.state.selectedObjectId}
            selectedObject={editor.selectedObject}
            selectedObjectCostLine={editor.selectedObjectCostLine}
            selectedObjectFocusRequestKey={editor.state.selectedObjectFocusRequestKey}
            hiddenObjectIds={editor.state.hiddenObjectIds}
            hiddenObjectCategories={editor.state.hiddenObjectCategories}
            selectedOsmWayId={editor.state.selectedOsmWayId}
            selectedOsmWay={editor.selectedOsmWay}
            selectedOsmFocusRequestKey={editor.state.selectedOsmFocusRequestKey}
            interactionMode={editor.interactionMode}
            readOnly={readOnly}
            mapContextReadOnly={!canEditMapContext}
            changeRequests={changeRequests}
            selectedChangeRequestId={selectedChangeRequestId}
            showChangeRequests={showChangeRequests}
            changeRequestColorMode={changeRequestColorMode}
            canVoteOnChangeRequests={mode === 'vote_internal'}
            currentUserId="landing-demo-user"
            currentUserDisplayName={t('pages.home.publicLanding.streetDesignPreview.demoUser')}
            onPointerDown={editor.handleScenePointerDown}
            onPointerMove={editor.handleScenePointerMove}
            onFinishPlacement={editor.finishPlacement}
            onFinishPathPlacement={editor.finishPathPlacement}
            onCancelPlacement={editor.cancelPlacement}
            onObjectSelect={editor.selectObject}
            onOsmWaySelect={editor.selectOsmWay}
            onObjectVisibilityChange={editor.setObjectVisibility}
            onOsmWayHide={editor.hideOsmWay}
            onOsmWayImport={editor.importOsmWay}
            onOsmImportUndo={editor.undoOsmImport}
            onObjectRotate={editor.rotateObject}
            onPropertyChange={editor.updateObjectProperty}
            onWidthChange={editor.updateObjectWidth}
            onRotationChange={editor.rotateObject}
            onUnitCostChange={editor.updateObjectUnitCost}
            onDeleteObject={editor.deleteObject}
            onChangeRequestSelect={setSelectedChangeRequestId}
            onChangeRequestVote={handleChangeRequestVote}
            onChangeRequestTitleChange={(changeRequestId, title) =>
              setChangeRequests(current =>
                current.map(request =>
                  request.id === changeRequestId ? { ...request, title } : request
                )
              )
            }
          />
        </StreetDesignWorkspaceView>
      </OverlayPortalBoundary>
    </div>
  );
}
