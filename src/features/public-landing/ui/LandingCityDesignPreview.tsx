'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { OverlayPortalBoundary } from '@/features/shared/ui/ui/overlay-portal-boundary';
import { StreetAreaPicker } from '@/features/amendments/city-design/ui/StreetAreaPicker';
import { StreetCostSummaryView } from '@/features/amendments/city-design/ui/StreetCostSummaryView';
import { CityDesignTopBarView } from '@/features/amendments/city-design/ui/CityDesignTopBarView';
import { CityDesignWorkspaceView } from '@/features/amendments/city-design/ui/CityDesignWorkspaceView';
import { StreetSceneCanvasView } from '@/features/amendments/city-design/ui/StreetSceneCanvasView';
import { useCityDesignEditorState } from '@/features/amendments/city-design/hooks/useCityDesignEditorState';
import { createEmptyCityDesignState } from '@/features/amendments/city-design/state/cityDesignReducer';
import {
  createPathCorridorCityDesignObject,
  createPointCityDesignObject,
} from '@/features/amendments/city-design/logic/cityDesignPlacement';
import { getCityDesignMapSelectionBoundingBox } from '@/features/amendments/city-design/logic/cityDesignBbox';
import {
  getCityDesignOsmFeatures,
  getCityDesignOsmLayerVisibility,
  isCityDesignFallbackSnapshot,
} from '@/features/amendments/city-design/logic/cityDesignOsm';
import { formatCityDesignSelectionAddress } from '@/features/amendments/city-design/logic/cityDesignSelectionAddress';
import { formatMinorCurrency } from '@/features/amendments/city-design/logic/cityDesignCostCatalog';
import { createCityDesignChangeRequestPayloads } from '@/features/amendments/city-design/logic/cityDesignChangeRequestDiff';
import type {
  CityDesignChangeRequest,
  CityDesignChangeRequestColorMode,
} from '@/features/amendments/city-design/logic/cityDesignChangeRequests';
import type {
  CityDesignCameraPose,
  CityDesignMapSelection,
  CityDesignSelectionAddress,
  CityDesignStateV1,
} from '@/features/amendments/city-design/types';
import {
  APP_TUTORIAL_CITY_DESIGN_ADDRESS,
  APP_TUTORIAL_CITY_DESIGN_BBOX,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION,
  createAppTutorialOsmSnapshot,
} from '@/features/app-tutorial/city-design-fixture';
import type { SelectableEditingMode } from '@/features/shared/ui/status';
import { overpassStreetSceneFn } from '@/server/overpass-street-scene';

const demoModes = [
  'view',
  'edit',
  'suggest_internal',
  'vote_internal',
] as const satisfies readonly SelectableEditingMode[];

const landingStreetOrigin = {
  ...APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.center,
  label: APP_TUTORIAL_CITY_DESIGN_ADDRESS.formatted,
};
const landingStreetCameraPose: CityDesignCameraPose = {
  position: { x: 0, y: 118, z: 132 },
  target: { x: 0, y: 0, z: 0 },
};
const defaultLandingMapSelection: CityDesignMapSelection = {
  center: { ...APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.center },
  widthMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.widthMeters,
  heightMeters: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.heightMeters,
  rotationDeg: APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION.rotationDeg,
};
const defaultLandingAddress: CityDesignSelectionAddress = {
  ...APP_TUTORIAL_CITY_DESIGN_ADDRESS,
};

function isSameNumber(left: number, right: number) {
  return Math.abs(left - right) < 1e-9;
}

function isDefaultLandingMapSelection(selection: CityDesignMapSelection) {
  return (
    isSameNumber(selection.center.lat, defaultLandingMapSelection.center.lat) &&
    isSameNumber(selection.center.lon, defaultLandingMapSelection.center.lon) &&
    isSameNumber(selection.widthMeters, defaultLandingMapSelection.widthMeters) &&
    isSameNumber(selection.heightMeters, defaultLandingMapSelection.heightMeters) &&
    isSameNumber(selection.rotationDeg, defaultLandingMapSelection.rotationDeg)
  );
}

function createLandingInitialDesign(): CityDesignStateV1 {
  const base = createEmptyCityDesignState(landingStreetOrigin);
  return {
    ...base,
    mapSelection: defaultLandingMapSelection,
    selectionAddress: defaultLandingAddress,
    osmSnapshot: createAppTutorialOsmSnapshot(),
    comparisonMode: 'overlay',
    objects: [
      createPathCorridorCityDesignObject({
        id: 'landing-bike-lane',
        type: 'bike_lane',
        points: [
          { x: -42, z: 10 },
          { x: 0, z: 6 },
          { x: 42, z: 2 },
        ],
        width: 3,
      }),
      createPointCityDesignObject({
        id: 'landing-tree',
        type: 'tree',
        point: { x: -22, z: -8 },
      }),
      createPointCityDesignObject({
        id: 'landing-bank',
        type: 'bank',
        point: { x: 24, z: -7 },
      }),
    ],
  };
}

function createInitialChangeRequest(title: string): CityDesignChangeRequest {
  const tree = createPointCityDesignObject({
    id: 'landing-cr-tree',
    type: 'tree',
    point: { x: 18, z: -13 },
  });
  return {
    id: 'landing-street-cr-1',
    display_cr_id: 'CR-12',
    title,
    source_type: 'city_design_object',
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

export function LandingCityDesignPreview() {
  const { t } = useTranslation();
  const initialDesign = useMemo(createLandingInitialDesign, []);
  const editor = useCityDesignEditorState(initialDesign);
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
  const changeRequestColorMode: CityDesignChangeRequestColorMode = 'natural';
  const [changeRequests, setChangeRequests] = useState<CityDesignChangeRequest[]>(() => [
    createInitialChangeRequest(t('pages.home.publicLanding.cityDesignPreview.changeRequestTitle')),
  ]);
  const [voteByRequest, setVoteByRequest] = useState<
    Record<string, 'accept' | 'reject' | 'abstain'>
  >({});
  const loadRequestId = useRef(0);

  const readOnly = mode === 'view' || mode === 'vote_internal';
  const canEditMapContext = mode === 'edit';
  const selectedMapSelection = editor.design.mapSelection ?? defaultLandingMapSelection;
  const selectedCenter = selectedMapSelection.center;
  const selectedBbox = useMemo(
    () => getCityDesignMapSelectionBoundingBox(selectedMapSelection),
    [selectedMapSelection]
  );
  const selectionAddressLabel = formatCityDesignSelectionAddress(
    editor.design.selectionAddress,
    editor.design.origin.label,
    selectedCenter
  );
  const osmFeatures = getCityDesignOsmFeatures(editor.design.osmSnapshot);
  const osmUsesFallback = isCityDesignFallbackSnapshot(editor.design.osmSnapshot);
  const osmUsesStoredSnapshot =
    editor.design.osmSnapshot !== null &&
    isSameNumber(editor.design.osmSnapshot.bbox.south, APP_TUTORIAL_CITY_DESIGN_BBOX.south) &&
    isSameNumber(editor.design.osmSnapshot.bbox.west, APP_TUTORIAL_CITY_DESIGN_BBOX.west) &&
    isSameNumber(editor.design.osmSnapshot.bbox.north, APP_TUTORIAL_CITY_DESIGN_BBOX.north) &&
    isSameNumber(editor.design.osmSnapshot.bbox.east, APP_TUTORIAL_CITY_DESIGN_BBOX.east);
  const osmStatus = isLoadingOsm
    ? t('pages.home.publicLanding.cityDesignPreview.loadingOsm')
    : osmError
      ? t('pages.home.publicLanding.cityDesignPreview.osmUnavailable')
      : osmUsesFallback
        ? t('pages.home.publicLanding.cityDesignPreview.osmFallback')
        : osmUsesStoredSnapshot
          ? t('pages.home.publicLanding.cityDesignPreview.osmStored')
          : t('pages.home.publicLanding.cityDesignPreview.osmLive');
  const placementDraft = editor.state.placementDraft;
  const placementPreview = placementDraft?.preview ?? null;
  const canFinishPathPlacement =
    placementDraft?.mode === 'path' && placementDraft.points.length >= 2;

  const loadOsm = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setIsLoadingOsm(true);
    setOsmError(null);
    try {
      const useStoredSnapshot = isDefaultLandingMapSelection(selectedMapSelection);
      const snapshot = useStoredSnapshot
        ? createAppTutorialOsmSnapshot()
        : await overpassStreetSceneFn({ data: { bbox: selectedBbox } });
      if (requestId !== loadRequestId.current) return;
      const nextSelectionAddress = useStoredSnapshot
        ? { ...defaultLandingAddress }
        : editor.design.selectionAddress;
      const nextAddressLabel = useStoredSnapshot
        ? defaultLandingAddress.formatted
        : selectionAddressLabel;
      const nextDesign: CityDesignStateV1 = {
        ...editor.design,
        origin: {
          ...selectedCenter,
          label: nextAddressLabel,
        },
        mapSelection: selectedMapSelection,
        selectionAddress: nextSelectionAddress,
        osmSnapshot: snapshot,
        hiddenOsmWayIds: [],
        hiddenOsmFeatureIds: [],
        comparisonMode: 'overlay',
      };
      editor.replaceDesign(nextDesign, true);
    } catch (error) {
      if (requestId !== loadRequestId.current) return;
      setOsmError(
        error instanceof Error
          ? error.message
          : t('pages.home.publicLanding.cityDesignPreview.osmError')
      );
    } finally {
      if (requestId === loadRequestId.current) setIsLoadingOsm(false);
    }
  }, [editor, selectedBbox, selectedCenter, selectedMapSelection, selectionAddressLabel, t]);

  const modeDisabledReasons = useMemo(() => {
    if (!editor.state.isDirty) return {};
    const reason = t('pages.home.publicLanding.cityDesignPreview.saveBeforeModeChange');
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
        const payloads = createCityDesignChangeRequestPayloads({
          amendmentId: 'landing-demo-amendment',
          cityDesignId: 'landing-demo-city-design',
          baseDesign,
          draftDesign: editor.design,
        });
        const nextRequests: CityDesignChangeRequest[] = payloads.map((payload, index) => ({
          ...payload,
          display_cr_id: `CR-${13 + changeRequests.length + index}`,
          title:
            payload.source_title ?? t('pages.home.publicLanding.cityDesignPreview.localSuggestion'),
          votes_for: 0,
          votes_against: 0,
          votes_abstain: 0,
        }));
        if (nextRequests.length > 0) {
          setChangeRequests(current => [...current, ...nextRequests]);
          setSelectedChangeRequestId(nextRequests[0].id);
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
          : t('pages.home.publicLanding.cityDesignPreview.localSaveError')
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
          accept: request.votes_for as number,
          reject: request.votes_against as number,
          abstain: request.votes_abstain as number,
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
        void loadOsm();
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
    t('features.amendments.cityDesign.metrics.existing', { count: osmFeatures.length }),
    t('features.amendments.cityDesign.metrics.elements', {
      count: editor.design.objects.length,
    }),
    t('features.amendments.cityDesign.metrics.cost', {
      cost: formatMinorCurrency(editor.costSummary.totalCostMinor, editor.costSummary.currency),
    }),
    t('features.amendments.cityDesign.metrics.changeRequests', {
      count: changeRequests.length,
    }),
  ];

  const topBar = (
    <CityDesignTopBarView
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
      osmLayerVisibility={getCityDesignOsmLayerVisibility(editor.design.osmLayerVisibility)}
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
      onLoadOsm={() => void loadOsm()}
      onOsmWayHide={editor.hideOsmWay}
    />
  );

  return (
    <div
      ref={setPortalContainer}
      className="landing-city-design-preview bg-background relative isolate h-[min(46rem,calc(100dvh-2rem))] min-h-[38rem] overflow-y-auto rounded-lg border shadow-sm"
      data-testid="landing-street-demo-window"
    >
      <OverlayPortalBoundary container={portalContainer}>
        <CityDesignWorkspaceView
          embedded
          topBar={topBar}
          title={t('pages.home.publicLanding.cityDesignPreview.title')}
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
            currentUserDisplayName={t('pages.home.publicLanding.cityDesignPreview.demoUser')}
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
        </CityDesignWorkspaceView>
      </OverlayPortalBoundary>
    </div>
  );
}
