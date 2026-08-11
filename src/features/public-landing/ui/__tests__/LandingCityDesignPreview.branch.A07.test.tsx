/* @vitest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  areaProps: undefined as Record<string, unknown> | undefined,
  canvasProps: undefined as Record<string, unknown> | undefined,
  changePayloads: vi.fn(() => [] as Record<string, unknown>[]),
  createStoredSnapshot: vi.fn(() => ({
    bbox: { south: 48, west: 11, north: 49, east: 12 },
    features: [{ id: 'stored' }],
    fallback: false,
  })),
  defaultAddress: { formatted: 'Default street' },
  defaultBbox: { south: 48, west: 11, north: 49, east: 12 },
  defaultSelection: {
    center: { lat: 48.1, lon: 11.5 },
    widthMeters: 360,
    heightMeters: 280,
    rotationDeg: 0,
  },
  editor: undefined as Record<string, unknown> | undefined,
  overpass: vi.fn(),
  topProps: undefined as Record<string, unknown> | undefined,
  workspaceProps: undefined as Record<string, unknown> | undefined,
}));

const defaultSelection = mocks.defaultSelection;
const defaultAddress = mocks.defaultAddress;
const defaultBbox = mocks.defaultBbox;

function storedSnapshot() {
  return { bbox: { ...defaultBbox }, features: [{ id: 'stored' }], fallback: false };
}

function createEditor() {
  const editor = {
    design: {
      origin: { ...defaultSelection.center, label: 'Default street' },
      mapSelection: null as null | typeof defaultSelection,
      selectionAddress: defaultAddress,
      osmSnapshot: { ...storedSnapshot(), fallback: true } as Record<string, unknown> | null,
      comparisonMode: 'overlay',
      objects: [{ id: 'object-1' }],
      osmLayerVisibility: {},
      showStreetMarkings: undefined as boolean | undefined,
    },
    state: {
      isDirty: false,
      placementDraft: undefined as
        | undefined
        | { mode: string; points: unknown[]; preview?: unknown; start?: unknown; type?: string },
      selectedObjectId: null,
      hiddenObjectIds: [],
      hiddenObjectCategories: [],
      selectedObjectFocusRequestKey: 0,
      selectedOsmWayId: null,
      selectedOsmFocusRequestKey: 0,
      selectedTool: 'select',
    },
    placementSettings: { properties: {} },
    interactionMode: 'select',
    costSummary: { totalCostMinor: 100, currency: 'EUR' },
    selectedOsmWay: null,
    selectedObject: null,
    selectedObjectCostLine: null,
    replaceDesign: vi.fn((design: Record<string, unknown>, dirty: boolean) => {
      editor.design = design as typeof editor.design;
      editor.state.isDirty = dirty;
    }),
    setInteractionMode: vi.fn((mode: string) => {
      editor.interactionMode = mode;
    }),
    updateMapContext: vi.fn(),
    updateSelectionAddress: vi.fn(),
    setComparisonMode: vi.fn(),
    selectObject: vi.fn(),
    deleteObject: vi.fn(),
    deleteObjectCategory: vi.fn(),
    setSelectedTool: vi.fn(),
    setObjectVisibility: vi.fn(),
    setObjectCategoryVisibility: vi.fn(),
    setOsmLayerVisibility: vi.fn(),
    setShowStreetMarkings: vi.fn(),
    hideOsmWay: vi.fn(),
    handleScenePointerDown: vi.fn(),
    handleScenePointerMove: vi.fn(),
    finishPlacement: vi.fn(),
    finishPathPlacement: vi.fn(),
    cancelPlacement: vi.fn(),
    selectOsmWay: vi.fn(),
    importOsmWay: vi.fn(),
    undoOsmImport: vi.fn(),
    rotateObject: vi.fn(),
    updateObjectProperty: vi.fn(),
    updateObjectWidth: vi.fn(),
    updateObjectUnitCost: vi.fn(),
  };
  return editor;
}

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/overlay-portal-boundary', () => ({
  OverlayPortalBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/amendments/city-design/hooks/useCityDesignEditorState', () => ({
  useCityDesignEditorState: () => mocks.editor,
}));

vi.mock('@/features/amendments/city-design/state/cityDesignReducer', () => ({
  createEmptyCityDesignState: (origin: Record<string, unknown>) => ({
    origin,
    objects: [],
    osmLayerVisibility: {},
    showStreetMarkings: true,
  }),
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignPlacement', () => ({
  createPathCorridorCityDesignObject: (input: Record<string, unknown>) => input,
  createPointCityDesignObject: (input: Record<string, unknown>) => input,
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignBbox', () => ({
  getCityDesignMapSelectionBoundingBox: () => ({ ...mocks.defaultBbox }),
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignOsm', () => ({
  getCityDesignOsmFeatures: (snapshot: { features?: unknown[] } | null) => snapshot?.features ?? [],
  getCityDesignOsmLayerVisibility: (visibility: unknown) => visibility,
  isCityDesignFallbackSnapshot: (snapshot: { fallback?: boolean } | null) =>
    Boolean(snapshot?.fallback),
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignSelectionAddress', () => ({
  formatCityDesignSelectionAddress: (
    address: { formatted?: string } | null,
    origin: string,
    center: { lat: number; lon: number }
  ) => address?.formatted ?? origin ?? `${center.lat},${center.lon}`,
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignCostCatalog', () => ({
  formatMinorCurrency: (value: number, currency: string) => `${value} ${currency}`,
}));

vi.mock('@/features/amendments/city-design/logic/cityDesignChangeRequestDiff', () => ({
  createCityDesignChangeRequestPayloads: mocks.changePayloads,
}));

vi.mock('@/features/app-tutorial/city-design-fixture', () => ({
  APP_TUTORIAL_CITY_DESIGN_ADDRESS: mocks.defaultAddress,
  APP_TUTORIAL_CITY_DESIGN_BBOX: mocks.defaultBbox,
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION: mocks.defaultSelection,
  createAppTutorialOsmSnapshot: mocks.createStoredSnapshot,
}));

vi.mock('@/server/overpass-street-scene', () => ({
  overpassStreetSceneFn: mocks.overpass,
}));

vi.mock('@/features/amendments/city-design/ui/CityDesignTopBarView', () => ({
  CityDesignTopBarView: (props: Record<string, unknown>) => {
    mocks.topProps = props;
    return (
      <div data-testid="top-bar">
        {props.areaPickerContent as ReactNode}
        {props.costSummaryContent as ReactNode}
      </div>
    );
  },
}));

vi.mock('@/features/amendments/city-design/ui/StreetAreaPicker', () => ({
  StreetAreaPicker: (props: Record<string, unknown>) => {
    mocks.areaProps = props;
    return <div data-testid="area-picker" />;
  },
}));

vi.mock('@/features/amendments/city-design/ui/StreetCostSummaryView', () => ({
  StreetCostSummaryView: () => <div data-testid="cost-summary" />,
}));

vi.mock('@/features/amendments/city-design/ui/CityDesignWorkspaceView', () => ({
  CityDesignWorkspaceView: ({ children, topBar, ...props }: Record<string, unknown>) => {
    mocks.workspaceProps = props;
    return (
      <div>
        {topBar as ReactNode}
        {children as ReactNode}
      </div>
    );
  },
}));

vi.mock('@/features/amendments/city-design/ui/StreetSceneCanvasView', () => ({
  StreetSceneCanvasView: (props: Record<string, unknown>) => {
    mocks.canvasProps = props;
    return <div data-testid="canvas" />;
  },
}));

import { LandingCityDesignPreview } from '../LandingCityDesignPreview';

interface TopProps {
  mode: string;
  modeDisabledReasons: Record<string, string>;
  onModeChange: (mode: string) => void;
  onSave: () => void;
  onLoadOsm: () => void;
  osmError: string | null;
  isLoadingOsm: boolean;
  showStreetMarkings: boolean;
}
interface AreaProps {
  onMapSelectionChange: (selection: typeof defaultSelection) => void;
  onSelectionAddressChange: (address: typeof defaultAddress) => void;
  onLoadOsm: () => void;
  readOnly: boolean;
}
interface CanvasProps {
  canFinishPathPlacement: boolean;
  placementMode: string | null;
  placementPointCount: number;
  placementPreview: unknown;
  placementPreviewType: string | null;
  placementStart: unknown;
  changeRequests: Record<string, unknown>[];
  onChangeRequestVote: (id: string, vote: 'accept' | 'reject' | 'abstain') => void;
  onChangeRequestTitleChange: (id: string, title: string) => void;
}

const top = () => mocks.topProps as unknown as TopProps;
const area = () => mocks.areaProps as unknown as AreaProps;
const canvas = () => mocks.canvasProps as unknown as CanvasProps;
const editor = () => mocks.editor as unknown as ReturnType<typeof createEditor>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe('LandingCityDesignPreview branch campaign A07', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.editor = createEditor();
    mocks.changePayloads.mockReturnValue([]);
    mocks.overpass.mockResolvedValue({ bbox: defaultBbox, features: [{ id: 'live' }] });
  });

  afterEach(cleanup);

  it('covers fallback map, placement boundaries and read-only map interactions', () => {
    const view = render(<LandingCityDesignPreview />);
    expect(mocks.workspaceProps?.selectionAddressLabel as string).toContain('osmFallback');
    expect(top().showStreetMarkings).toBe(true);
    expect(canvas()).toMatchObject({
      canFinishPathPlacement: false,
      placementMode: null,
      placementPointCount: 0,
      placementPreview: null,
      placementPreviewType: null,
      placementStart: null,
    });

    editor().design.osmSnapshot = null;
    editor().design.showStreetMarkings = false;
    editor().state.placementDraft = {
      mode: 'path',
      points: [{}, {}],
      preview: { x: 1 },
      start: { x: 0 },
      type: 'bike_lane',
    };
    view.rerender(<LandingCityDesignPreview />);
    expect(canvas().canFinishPathPlacement).toBe(true);
    expect(top().showStreetMarkings).toBe(false);

    editor().state.placementDraft = { mode: 'path', points: [{}] };
    view.rerender(<LandingCityDesignPreview />);
    expect(canvas().canFinishPathPlacement).toBe(false);
    editor().state.placementDraft = { mode: 'point', points: [{}, {}] };
    view.rerender(<LandingCityDesignPreview />);
    expect(canvas().canFinishPathPlacement).toBe(false);

    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    expect(Object.keys(top().modeDisabledReasons)).toHaveLength(3);
    act(() => top().onModeChange('view'));
    expect(top().mode).toBe('edit');

    editor().state.isDirty = false;
    view.rerender(<LandingCityDesignPreview />);
    act(() => top().onModeChange('unsupported'));
    expect(top().mode).toBe('edit');
    act(() => top().onModeChange('vote_internal'));
    expect(top().mode).toBe('vote_internal');
    expect(area().readOnly).toBe(true);
    act(() => {
      area().onMapSelectionChange(defaultSelection);
      area().onSelectionAddressChange(defaultAddress);
    });
    expect(editor().updateMapContext).not.toHaveBeenCalled();
    expect(editor().updateSelectionAddress).not.toHaveBeenCalled();

    act(() => top().onModeChange('edit'));
    act(() => {
      area().onMapSelectionChange(defaultSelection);
      area().onSelectionAddressChange(defaultAddress);
    });
    expect(editor().updateMapContext).toHaveBeenCalled();
    expect(editor().updateSelectionAddress).toHaveBeenCalled();
  });

  it('ignores stale OSM completions and exposes current Error and non-Error failures', async () => {
    editor().design.mapSelection = {
      ...defaultSelection,
      center: { lat: 47, lon: 10 },
    };
    const first = deferred<Record<string, unknown>>();
    const second = deferred<Record<string, unknown>>();
    mocks.overpass
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<LandingCityDesignPreview />);

    act(() => top().onLoadOsm());
    act(() => top().onLoadOsm());
    expect(top().isLoadingOsm).toBe(true);
    await act(async () => first.resolve({ bbox: defaultBbox, features: [{ id: 'stale' }] }));
    expect(editor().replaceDesign).not.toHaveBeenCalled();
    await act(async () => second.resolve({ bbox: defaultBbox, features: [{ id: 'current' }] }));
    await waitFor(() => expect(editor().replaceDesign).toHaveBeenCalledTimes(1));

    const staleFailure = deferred<Record<string, unknown>>();
    const currentSuccess = deferred<Record<string, unknown>>();
    mocks.overpass
      .mockReset()
      .mockReturnValueOnce(staleFailure.promise)
      .mockReturnValueOnce(currentSuccess.promise);
    act(() => top().onLoadOsm());
    act(() => top().onLoadOsm());
    await act(async () => staleFailure.reject('stale failure'));
    expect(top().osmError).toBeNull();
    await act(async () => currentSuccess.resolve({ bbox: defaultBbox, features: [] }));

    mocks.overpass.mockRejectedValueOnce(new Error('Overpass failed'));
    act(() => top().onLoadOsm());
    await waitFor(() => expect(top().osmError).toBe('Overpass failed'));
    mocks.overpass.mockRejectedValueOnce('offline');
    act(() => top().onLoadOsm());
    await waitFor(() =>
      expect(top().osmError).toBe('pages.home.publicLanding.cityDesignPreview.osmError')
    );
  });

  it('covers save guards, empty suggestions, generated titles and save failures', async () => {
    const view = render(<LandingCityDesignPreview />);
    act(() => top().onSave());
    expect(editor().replaceDesign).not.toHaveBeenCalled();

    editor().state.isDirty = false;
    act(() => top().onModeChange('view'));
    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    act(() => top().onSave());
    expect(editor().replaceDesign).not.toHaveBeenCalled();

    editor().state.isDirty = false;
    view.rerender(<LandingCityDesignPreview />);
    act(() => top().onModeChange('suggest_internal'));
    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    mocks.changePayloads.mockReturnValueOnce([]);
    act(() => top().onSave());
    await waitFor(() => expect(editor().replaceDesign).toHaveBeenCalledTimes(1));

    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    mocks.changePayloads.mockReturnValueOnce([
      { id: 'local-request', source_title: undefined, source_type: 'object', source_id: 'one' },
    ]);
    act(() => top().onSave());
    await waitFor(() => expect(canvas().changeRequests).toHaveLength(2));
    expect(canvas().changeRequests[1]?.title).toBe(
      'pages.home.publicLanding.cityDesignPreview.localSuggestion'
    );

    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    mocks.changePayloads.mockImplementationOnce(() => {
      throw new Error('Save failed');
    });
    act(() => top().onSave());
    await waitFor(() => expect(mocks.topProps?.saveError).toBe('Save failed'));

    editor().state.isDirty = true;
    view.rerender(<LandingCityDesignPreview />);
    mocks.changePayloads.mockImplementationOnce(() => {
      throw 'bad save';
    });
    act(() => top().onSave());
    await waitFor(() =>
      expect(mocks.topProps?.saveError).toBe(
        'pages.home.publicLanding.cityDesignPreview.localSaveError'
      )
    );
  });

  it('guards votes, changes existing votes and updates only matching request titles', () => {
    render(<LandingCityDesignPreview />);
    act(() => canvas().onChangeRequestVote('landing-street-cr-1', 'accept'));
    expect(canvas().changeRequests[0]?.votes_for).toBe(12);

    act(() => top().onModeChange('vote_internal'));
    act(() => canvas().onChangeRequestVote('missing-request', 'accept'));
    expect(canvas().changeRequests[0]?.votes_for).toBe(12);
    act(() => canvas().onChangeRequestVote('landing-street-cr-1', 'accept'));
    expect(canvas().changeRequests[0]?.votes_for).toBe(13);
    act(() => canvas().onChangeRequestVote('landing-street-cr-1', 'reject'));
    expect(canvas().changeRequests[0]).toMatchObject({ votes_for: 12, votes_against: 3 });

    act(() => canvas().onChangeRequestTitleChange('missing-request', 'Ignored'));
    expect(canvas().changeRequests[0]?.title).not.toBe('Ignored');
    act(() => canvas().onChangeRequestTitleChange('landing-street-cr-1', 'Updated'));
    expect(canvas().changeRequests[0]?.title).toBe('Updated');
  });
});
