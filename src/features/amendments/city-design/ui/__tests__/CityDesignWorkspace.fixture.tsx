import { useState } from 'react';
import { CityDesignPageView } from '../CityDesignPageView';
import { useCityDesignEditorState } from '../../hooks/useCityDesignEditorState';
import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import {
  createAppTutorialInitialCityDesignState,
  createAppTutorialOsmSnapshot,
} from '@/features/app-tutorial/city-design-fixture';
import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { getAppShellResponsiveClasses } from '@/layout/app-shell-layout';
import type { NavigationView } from '@/features/navigation/types/navigation.types';
import type { CityDesignStateV1 } from '../../types';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';
const noop = () => {
  /* The fixture keeps non-layout workflows inactive. */
};
export function createCityDesignWorkspaceProps(
  overrides: Partial<Parameters<typeof CityDesignPageView>[0]> = {}
) {
  const design: CityDesignStateV1 = {
    ...createEmptyCityDesignState(),
    osmSnapshot: {
      fetchedAt: 0,
      bbox: {
        north: 52.53,
        south: 52.51,
        east: 13.42,
        west: 13.39,
      },
      features: Array.from({ length: 253 }, (_, index) => ({
        id: `road-${index}`,
        kind: 'road',
        geometryKind: 'line',
        points: [
          { lat: 52.52, lon: 13.4 },
          { lat: 52.521, lon: 13.401 },
        ],
        source: 'osm',
      })),
    },
  };

  return {
    amendmentId: 'amendment-1',
    amendment: { title: 'Safer street' },
    isLoading: false,
    showActionBars: true,
    readOnly: false,
    canEditMapContext: true,
    mode: 'edit',
    modeDisabledReasons: {},
    canChangeMode: true,
    canVoteOnStreetChangeRequests: false,
    canFinalizeStreetChangeRequests: false,
    currentUserId: 'user-1',
    currentUserDisplayName: 'Ada Lovelace',
    currentUserAvatarUrl: null,
    collaborationDocumentId: 'document-1',
    editorCollaborators: [],
    existingCollaboratorIds: [],
    onlinePeerMap: new Map(),
    activeCursorUserIds: new Set(),
    presenceColorByUserId: new Map(),
    remoteCursors: [],
    streetChangeRequests: [],
    cityDesignDiscussions: [],
    changeRequestColorMode: 'natural',
    design,
    selectedObject: null,
    selectedOsmWay: null,
    selectedObjectCostLine: null,
    selectedObjectId: null,
    selectedObjectFocusRequestKey: 0,
    selectedOsmFocusRequestKey: 0,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    selectedTool: 'tree',
    interactionMode: 'select',
    placementSettings: {
      type: 'tree',
      width: 1,
      rotationDeg: 0,
      rotationLocked: false,
      properties: {},
      customUnitCostMinor: null,
    },
    selectedCenter: { lat: 52.52, lon: 13.4 },
    selectedBbox: design.osmSnapshot!.bbox,
    selectedMapSelection: {
      center: { lat: 52.52, lon: 13.4 },
      widthMeters: 100,
      heightMeters: 100,
      rotationDeg: 0,
    },
    selectionAddressLabel: 'Alexanderplatz, Berlin',
    costSummary: {
      currency: 'EUR',
      totalCostMinor: 0,
      categories: [],
      lines: [],
    },
    isDirty: false,
    placementPreview: null,
    placementPreviewType: null,
    placementStart: null,
    placementMode: null,
    placementPointCount: 0,
    canFinishPathPlacement: false,
    osmLayerVisibility: design.osmLayerVisibility ?? DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
    showStreetMarkings: true,
    isLoadingOsm: false,
    osmError: null,
    isSaving: false,
    saveError: null,
    onSelectedMapSelectionChange: noop,
    onSelectionAddressChange: noop,
    onLoadOsm: noop,
    onSave: noop,
    onModeChange: noop,
    onChangeRequestVote: noop,
    onChangeRequestFinalize: noop,
    onChangeRequestTitleChange: noop,
    onChangeRequestCommentSubmit: noop,
    onChangeRequestColorModeChange: noop,
    onToolChange: noop,
    onInteractionModeChange: noop,
    onComparisonModeChange: noop,
    onScenePointerDown: noop,
    onScenePointerMove: noop,
    onScenePointerHover: noop,
    onFinishPlacement: noop,
    onFinishPathPlacement: noop,
    onCancelPlacement: noop,
    onObjectSelect: noop,
    onOsmWaySelect: noop,
    onObjectVisibilityChange: noop,
    onObjectCategoryVisibilityChange: noop,
    onOsmWayHide: noop,
    onOsmLayerVisibilityChange: noop,
    onShowStreetMarkingsChange: noop,
    onPlacementPropertyChange: noop,
    onPlacementWidthChange: noop,
    onPlacementRotationChange: noop,
    onPlacementUnitCostChange: noop,
    onPropertyChange: noop,
    onWidthChange: noop,
    onRotationChange: noop,
    onUnitCostChange: noop,
    onDeleteObject: noop,
    onDeleteObjectCategory: noop,
    ...overrides,
  } satisfies Parameters<typeof CityDesignPageView>[0];
}

const design = {
  ...createAppTutorialInitialCityDesignState(),
  osmSnapshot: createAppTutorialOsmSnapshot(),
  objects: [
    createPointCityDesignObject({ id: 'tree-1', type: 'tree', point: { x: 0, z: 0 } }),
    createPointCityDesignObject({ id: 'tree-2', type: 'tree', point: { x: 10, z: 0 } }),
    createPointCityDesignObject({ id: 'bench-1', type: 'bank', point: { x: 20, z: 0 } }),
  ],
};

export function CityDesignWorkspaceFixture({
  navigationView = 'asButtonList',
  mobile = false,
}: {
  navigationView?: NavigationView;
  mobile?: boolean;
}) {
  const editor = useCityDesignEditorState(design);
  const [chatOpen, setChatOpen] = useState(false);
  const frame = getAppShellResponsiveClasses({
    screenType: mobile ? 'mobile' : 'desktop',
    navigationView,
    isSecondaryNavVisible: true,
  });
  return (
    <div className="flow-root min-h-screen">
      <div className={frame} data-testid="editor-frame">
        <CityDesignPageView
          {...createCityDesignWorkspaceProps({
            amendment: { title: 'Mehr Bäume für die Euckenstraße' },
            selectionAddressLabel: 'Euckenstraße 38, München',
            currentUserId: undefined,
            collaborationDocumentId: undefined,
            selectedCenter: design.origin,
            selectedMapSelection: design.mapSelection!,
            selectedBbox: design.osmSnapshot.bbox,
            design: editor.design,
            selectedObject: editor.selectedObject,
            selectedObjectCostLine: editor.selectedObjectCostLine,
            selectedOsmWay: editor.selectedOsmWay,
            selectedObjectId: editor.state.selectedObjectId,
            selectedObjectFocusRequestKey: editor.state.selectedObjectFocusRequestKey,
            selectedOsmFocusRequestKey: editor.state.selectedOsmFocusRequestKey,
            hiddenObjectIds: editor.state.hiddenObjectIds,
            hiddenObjectCategories: editor.state.hiddenObjectCategories,
            selectedTool: editor.state.selectedTool,
            placementSettings: editor.placementSettings,
            interactionMode: editor.interactionMode,
            costSummary: editor.costSummary,
            isDirty: editor.state.isDirty,
            onSave: () => editor.replaceDesign(editor.design),
            onToolChange: editor.setSelectedTool,
            onObjectSelect: editor.selectObject,
            onOsmWaySelect: editor.selectOsmWay,
            onComparisonModeChange: editor.setComparisonMode,
            onInteractionModeChange: editor.setInteractionMode,
            onObjectVisibilityChange: editor.setObjectVisibility,
            onObjectCategoryVisibilityChange: editor.setObjectCategoryVisibility,
            onPropertyChange: editor.updateObjectProperty,
            onWidthChange: editor.updateObjectWidth,
            onRotationChange: editor.rotateObject,
            onUnitCostChange: editor.updateObjectUnitCost,
            onDeleteObject: editor.deleteObject,
            onDeleteObjectCategory: editor.deleteObjectCategory,
            onOsmWayHide: editor.hideOsmWay,
            onOsmWayImport: editor.importOsmWay,
            onOsmImportUndo: editor.undoOsmImport,
            onOsmLayerVisibilityChange: editor.setOsmLayerVisibility,
            onShowStreetMarkingsChange: editor.setShowStreetMarkings,
          })}
        />
        <button
          className="bg-background fixed right-4 bottom-4 z-40 rounded border p-2"
          onClick={() => setChatOpen(!chatOpen)}
        >
          Toggle chat
        </button>
        {chatOpen && (
          <section
            data-project-chat-dock
            role="dialog"
            aria-label="Project chat"
            className="bg-background fixed right-4 bottom-16 z-40 h-80 w-[min(24rem,calc(100vw-2rem))] rounded border p-3"
          >
            Project chat
          </section>
        )}
      </div>
    </div>
  );
}
