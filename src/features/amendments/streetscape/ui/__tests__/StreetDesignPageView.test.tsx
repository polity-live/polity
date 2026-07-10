/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { StreetDesignPageView } from '../StreetDesignPageView';

vi.mock('@/features/editor/ui/OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: () => null,
}));

vi.mock('../StreetAreaPicker', () => ({
  StreetAreaPicker: () => <div data-testid="area-picker" />,
}));

vi.mock('../StreetCostSummaryView', () => ({
  StreetCostSummaryView: () => <div data-testid="cost-summary" />,
}));

vi.mock('../StreetDesignTopBarView', () => ({
  StreetDesignTopBarView: () => <div data-testid="street-design-topbar" />,
  StreetDesignSecondaryActionBarView: () => (
    <div data-testid="street-design-secondary-action-bar" />
  ),
}));

vi.mock('../StreetSceneCanvasView', () => ({
  StreetSceneCanvasView: () => <div data-testid="street-scene-canvas" />,
}));

describe('StreetDesignPageView', () => {
  it('shows KPI badges and opens the navigation help popover', () => {
    render(<StreetDesignPageView {...createPageProps()} />);

    expect(screen.getByText('253 existing')).toBeTruthy();
    expect(screen.getByText('0 elements')).toBeTruthy();
    expect(screen.getByText(content => /0\s*€/.test(content))).toBeTruthy();
    expect(screen.getByText('0 CRs')).toBeTruthy();

    const helpButton = screen.getByRole('button', {
      name: 'Show street design navigation help',
    });
    fireEvent.click(helpButton);

    expect(screen.getByText('Navigation help')).toBeTruthy();
    const touchTab = screen.getByRole('tab', { name: 'Touch' });
    const mouseTab = screen.getByRole('tab', { name: 'Mouse' });
    const keyboardTab = screen.getByRole('tab', { name: 'Keyboard' });
    expect(touchTab.getAttribute('data-state')).toBe('active');
    expect(screen.getByText('Select')).toBeTruthy();
    expect(screen.getByText('Place')).toBeTruthy();
    expect(screen.getByText('Camera')).toBeTruthy();
    expect(screen.getByText('Global navigation')).toBeTruthy();
    expect(screen.getByText(/Tap an element/)).toBeTruthy();
    expect(screen.getByText(/Use two fingers/)).toBeTruthy();

    fireEvent.mouseDown(mouseTab, { button: 0, ctrlKey: false });
    fireEvent.click(mouseTab);
    expect(screen.getByText(/Wheel zooms/)).toBeTruthy();
    expect(screen.getByText(/Right-drag or Shift\+drag turns/)).toBeTruthy();

    fireEvent.mouseDown(keyboardTab, { button: 0, ctrlKey: false });
    fireEvent.click(keyboardTab);
    expect(screen.getByText(/WASD or arrow keys move/)).toBeTruthy();
    expect(screen.getByText(/\+ and - zoom/)).toBeTruthy();
    expect(screen.getByText(/Q and E turn/)).toBeTruthy();
  });

  it('shows an unsaved changes warning badge only when the design is dirty', () => {
    const { rerender } = render(<StreetDesignPageView {...createPageProps()} />);

    expect(screen.queryByText('Unsaved changes')).toBeNull();

    rerender(<StreetDesignPageView {...createPageProps({ isDirty: true })} />);

    expect(screen.getByRole('status', { name: 'Unsaved changes' })).toBeTruthy();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});

function createPageProps(overrides: Partial<Parameters<typeof StreetDesignPageView>[0]> = {}) {
  const design = {
    ...createEmptyStreetDesignState(),
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
    readOnly: false,
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
    streetChangeRequests: [],
    streetDesignDiscussions: [],
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
      properties: {},
    },
    selectedCenter: { lat: 52.52, lon: 13.4 },
    selectedBbox: design.osmSnapshot.bbox,
    selectedMapSelection: {
      type: 'bbox',
      center: { lat: 52.52, lon: 13.4 },
      widthMeters: 100,
      heightMeters: 100,
      rotationDeg: 0,
    },
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
    osmLayerVisibility: design.osmLayerVisibility,
    showStreetMarkings: true,
    isLoadingOsm: false,
    osmError: null,
    isSaving: false,
    saveError: null,
    onSelectedMapSelectionChange: vi.fn(),
    onLoadOsm: vi.fn(),
    onLoadSample: vi.fn(),
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
    onFinishPlacement: vi.fn(),
    onFinishPathPlacement: vi.fn(),
    onCancelPlacement: vi.fn(),
    onObjectSelect: vi.fn(),
    onOsmWaySelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onObjectCategoryVisibilityChange: vi.fn(),
    onOsmWayHide: vi.fn(),
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
  } as Parameters<typeof StreetDesignPageView>[0];
}
