/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ canvasProps: undefined as any }));
vi.mock('@/features/editor/ui/OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: () => null,
}));
vi.mock('@/features/shared/ui/ui/not-found', () => ({ NotFound: () => null }));
vi.mock('../StreetAreaPicker', () => ({ StreetAreaPicker: () => null }));
vi.mock('../StreetCostSummaryView', () => ({ StreetCostSummaryView: () => null }));
vi.mock('../CityDesignTopBarView', () => ({
  CityDesignTopBarView: () => null,
  CityDesignSecondaryActionBarView: () => null,
}));
vi.mock('../CityDesignWorkspaceView', () => ({
  CityDesignWorkspaceView: ({ children, headerActions }: any) => (
    <>
      {headerActions}
      {children}
    </>
  ),
}));
vi.mock('../StreetSceneCanvasView', () => ({
  StreetSceneCanvasView: (props: any) => {
    mocks.canvasProps = props;
    return <div>canvas</div>;
  },
}));

import { createEmptyCityDesignState } from '../../state/cityDesignReducer';
import { CityDesignPageView } from '../CityDesignPageView';

afterEach(cleanup);

describe('CityDesignPageView LSF selection and help callbacks', () => {
  it('clears CR selection before forwarding object and OSM selection', () => {
    const onObjectSelect = vi.fn();
    const onOsmWaySelect = vi.fn();
    render(<CityDesignPageView {...pageProps({ onObjectSelect, onOsmWaySelect })} />);
    mocks.canvasProps.onObjectSelect('object-1');
    mocks.canvasProps.onOsmWaySelect('way-1');
    expect(onObjectSelect).toHaveBeenCalledWith('object-1');
    expect(onOsmWaySelect).toHaveBeenCalledWith('way-1');
  });

  it('opens navigation help from focus and pointer hover', () => {
    render(<CityDesignPageView {...pageProps({ showActionBars: true })} />);
    const help = screen.getByRole('button', { name: /navigation help/i });
    fireEvent.focus(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
    fireEvent.mouseEnter(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
  });
});

function pageProps(overrides: Record<string, unknown> = {}) {
  const design = createEmptyCityDesignState();
  return {
    amendmentId: 'a',
    amendment: { title: 'A' },
    isLoading: false,
    showActionBars: false,
    readOnly: false,
    canEditMapContext: true,
    mode: 'edit',
    modeDisabledReasons: {},
    canChangeMode: true,
    canVoteOnStreetChangeRequests: false,
    canFinalizeStreetChangeRequests: false,
    currentUserId: 'u',
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
    selectedCenter: design.origin,
    selectedBbox: { south: 0, west: 0, north: 1, east: 1 },
    selectedMapSelection: {
      center: design.origin,
      widthMeters: 10,
      heightMeters: 10,
      rotationDeg: 0,
    },
    selectionAddressLabel: 'Address',
    costSummary: { currency: 'EUR', totalCostMinor: 0, categories: [], lines: [] },
    isDirty: false,
    placementPreview: null,
    placementPreviewType: null,
    placementStart: null,
    placementMode: null,
    placementPointCount: 0,
    canFinishPathPlacement: false,
    osmLayerVisibility: design.osmLayerVisibility,
    showStreetMarkings: true,
    isLoadingOsm: false,
    osmError: null,
    isSaving: false,
    saveError: null,
    onSelectedMapSelectionChange: vi.fn(),
    onSelectionAddressChange: vi.fn(),
    onLoadOsm: vi.fn(),
    onSave: vi.fn(),
    onModeChange: vi.fn(),
    onChangeRequestVote: vi.fn(),
    onChangeRequestFinalize: vi.fn(),
    onChangeRequestTitleChange: vi.fn(),
    onChangeRequestCommentSubmit: vi.fn(),
    onChangeRequestColorModeChange: vi.fn(),
    onToolChange: vi.fn(),
    onInteractionModeChange: vi.fn(),
    onComparisonModeChange: vi.fn(),
    onScenePointerDown: vi.fn(),
    onScenePointerMove: vi.fn(),
    onScenePointerHover: vi.fn(),
    onFinishPlacement: vi.fn(),
    onFinishPathPlacement: vi.fn(),
    onCancelPlacement: vi.fn(),
    onObjectSelect: vi.fn(),
    onOsmWaySelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onObjectCategoryVisibilityChange: vi.fn(),
    onOsmWayHide: vi.fn(),
    onOsmWayImport: vi.fn(),
    onOsmImportUndo: vi.fn(),
    onOsmLayerVisibilityChange: vi.fn(),
    onShowStreetMarkingsChange: vi.fn(),
    onPlacementPropertyChange: vi.fn(),
    onPlacementWidthChange: vi.fn(),
    onPlacementRotationChange: vi.fn(),
    onPlacementUnitCostChange: vi.fn(),
    onPropertyChange: vi.fn(),
    onWidthChange: vi.fn(),
    onRotationChange: vi.fn(),
    onUnitCostChange: vi.fn(),
    onDeleteObject: vi.fn(),
    onDeleteObjectCategory: vi.fn(),
    ...overrides,
  } as any;
}
