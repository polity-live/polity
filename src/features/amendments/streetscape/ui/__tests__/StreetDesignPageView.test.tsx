/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyStreetDesignState } from '../../state/streetDesignReducer';
import { createPointStreetDesignObject } from '../../logic/streetDesignPlacement';
import { StreetDesignPageView } from '../StreetDesignPageView';

vi.mock('@/features/editor/ui/OnlineCollaboratorAvatars', () => ({
  OnlineCollaboratorAvatars: () => null,
}));

vi.mock('../StreetAreaPicker', () => ({
  StreetAreaPicker: ({ onLoadOsm }: { onLoadOsm: () => void }) => (
    <button type="button" onClick={onLoadOsm}>
      Load OSM from picker
    </button>
  ),
}));

vi.mock('../StreetCostSummaryView', () => ({
  StreetCostSummaryView: () => <div data-testid="cost-summary" />,
}));

vi.mock('../StreetDesignTopBarView', () => ({
  StreetDesignTopBarView: ({
    areaPickerContent,
    areaPickerOpen,
    onAreaPickerOpenChange,
    onObjectCategoryDelete,
  }: {
    areaPickerContent: ReactNode;
    areaPickerOpen: boolean;
    onAreaPickerOpenChange: (open: boolean) => void;
    onObjectCategoryDelete: (category: 'greenery') => void;
  }) => (
    <div data-testid="street-design-topbar">
      <span>{areaPickerOpen ? 'area picker open' : 'area picker closed'}</span>
      <button type="button" onClick={() => onAreaPickerOpenChange(true)}>
        Open map dialog
      </button>
      <button type="button" onClick={() => onObjectCategoryDelete('greenery')}>
        Delete greenery
      </button>
      {areaPickerOpen ? areaPickerContent : null}
    </div>
  ),
  StreetDesignSecondaryActionBarView: () => (
    <div data-testid="street-design-secondary-action-bar" />
  ),
}));

vi.mock('../StreetSceneCanvasView', () => ({
  StreetSceneCanvasView: ({ initialLegendOpen }: { initialLegendOpen: boolean }) => (
    <div data-testid="street-scene-canvas" data-initial-legend-open={String(initialLegendOpen)} />
  ),
}));

afterEach(() => {
  cleanup();
});

describe('StreetDesignPageView', () => {
  it('relies on the shared entity frame without another horizontal workspace inset', () => {
    const { container } = render(<StreetDesignPageView {...createPageProps()} />);
    const page = container.firstElementChild;
    const workspace = container.querySelector('[data-slot="street-design-page-content"]');

    expect(page?.className).not.toContain('pt-5');
    expect(workspace?.className).toContain('w-full');
    expect(workspace?.className).not.toContain('md:px-8');
  });

  it('hides both action bars for a signed-out read-only viewer', () => {
    render(
      <StreetDesignPageView
        {...createPageProps({ showActionBars: false, readOnly: true, currentUserId: undefined })}
      />
    );

    expect(screen.queryByTestId('street-design-topbar')).toBeNull();
    expect(screen.queryByTestId('street-design-secondary-action-bar')).toBeNull();
    expect(screen.getByTestId('street-scene-canvas')).toBeTruthy();
  });

  it('shows KPI badges and opens the navigation help popover', () => {
    render(<StreetDesignPageView {...createPageProps()} />);

    expect(screen.getByText('253 existing')).toBeTruthy();
    expect(screen.getByText('0 elements')).toBeTruthy();
    expect(screen.getByText(content => /€\s*0(?:[.,]00)?/.test(content))).toBeTruthy();
    expect(screen.getByText('0 CRs')).toBeTruthy();
    expect(screen.getByText('Alexanderplatz, Berlin')).toBeTruthy();
    expect(screen.getByTestId('street-scene-canvas').getAttribute('data-initial-legend-open')).toBe(
      'false'
    );

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

  it('closes the area picker dialog when loading OSM from the picker', () => {
    const props = createPageProps();
    render(<StreetDesignPageView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open map dialog' }));
    expect(screen.getByText('area picker open')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load OSM from picker' }));

    expect(props.onLoadOsm).toHaveBeenCalled();
    expect(screen.getByText('area picker closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load OSM from picker' })).toBeNull();
  });

  it('confirms the number of per-element CRs before deleting a category in suggestion mode', () => {
    const onDeleteObjectCategory = vi.fn();
    const design = {
      ...createEmptyStreetDesignState(),
      objects: [
        createPointStreetDesignObject({
          id: 'tree-1',
          type: 'tree',
          point: { x: 0, z: 0 },
        }),
        createPointStreetDesignObject({
          id: 'bush-1',
          type: 'bush',
          point: { x: 1, z: 1 },
        }),
      ],
    };
    render(
      <StreetDesignPageView
        {...createPageProps({ mode: 'suggest_event', design, onDeleteObjectCategory })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete greenery' }));

    expect(onDeleteObjectCategory).not.toHaveBeenCalled();
    expect(screen.getByText(/2 separate change requests/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create 2 change requests/ }));
    expect(onDeleteObjectCategory).toHaveBeenCalledWith('greenery');
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
