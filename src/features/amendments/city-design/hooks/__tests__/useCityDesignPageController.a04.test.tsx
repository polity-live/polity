/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: null as any,
  preference: null as any,
  userState: null as any,
  amendmentState: null as any,
  actions: null as any,
  documentActions: null as any,
  editor: null as any,
  access: null as any,
  locationOrigin: null as any,
  persistedDesign: null as any,
  overpass: vi.fn(),
  fallbackSnapshot: false,
  canVote: false,
  reportTutorial: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  createPayloads: vi.fn(),
  createPersistence: vi.fn(),
  waitForClientApply: vi.fn(),
  serverConfirmed: vi.fn(),
  broadcastCursor: vi.fn(),
  tutorialSnapshotError: false,
}));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => mocks.preference,
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => mocks.userState }));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => mocks.amendmentState,
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => mocks.actions,
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => mocks.documentActions,
}));
vi.mock('@/features/editor/hooks/useEditorPresence', () => ({
  useEditorPresence: () => ({ onlinePeers: [], userColor: '#123456' }),
}));
vi.mock('@/features/editor/logic/editor-helpers', () => ({
  generateDistinctUserColorMap: (ids: Set<string>) => new Map([...ids].map(id => [id, '#123456'])),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, values?: unknown) => `${key}${values ? ':values' : ''}`,
}));
vi.mock('@/server/overpass-street-scene', () => ({
  overpassStreetSceneFn: (...args: unknown[]) => mocks.overpass(...args),
}));
vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getBranchEditingMode: (branch: any) => branch.editing_mode ?? 'view',
  getBranchEditingModeDisabledReasons: () => [],
  isBranchEditable: (branch: any) => branch.editable !== false,
  resolveSelectedBranchId: ({ branches, activeBranchId }: any) =>
    activeBranchId ?? branches[0]?.id ?? null,
}));
vi.mock('@/zero/amendments/editing-mode-policy', () => ({
  isSuggestingMode: (mode: string) => mode === 'suggest_internal' || mode === 'suggest_event',
  isTerminalEditingMode: (mode: string) => mode === 'approved',
  isVotingMode: (mode: string) => mode === 'vote_event',
  normalizeEditingMode: (mode: string | null | undefined) => mode ?? 'view',
}));
vi.mock('../useCityDesignEditorState', () => ({
  useCityDesignEditorState: () => mocks.editor,
}));
vi.mock('../useCityDesignRemoteCursors', () => ({
  useCityDesignRemoteCursors: () => ({
    remoteCursors: [],
    activeCursorUserIds: new Set<string>(),
    broadcastCursor: mocks.broadcastCursor,
  }),
}));
vi.mock('../../logic/cityDesignPermissions', () => ({
  getCityDesignAccess: () => mocks.access,
}));
vi.mock('../../logic/cityDesignAmendmentLocation', () => ({
  getCityDesignOriginFromAmendmentLocation: () => mocks.locationOrigin,
}));
vi.mock('../../logic/cityDesignBbox', () => ({
  createCityDesignMapSelectionFromBbox: (bbox: unknown) => ({
    center: { lat: 10, lon: 20 },
    bbox,
  }),
  createCityDesignMapSelectionFromCenterRadius: (center: unknown) => ({ center }),
  getCityDesignMapSelectionBoundingBox: (selection: any) =>
    selection.bbox ?? { south: 9, west: 19, north: 11, east: 21 },
}));
vi.mock('../../state/cityDesignReducer', () => ({
  parseStoredCityDesignState: (value: unknown) => (value ? mocks.persistedDesign : null),
  createEmptyCityDesignState: () => mocks.persistedDesign,
}));
vi.mock('../../logic/cityDesignChangeRequestDiff', () => ({
  createCityDesignChangeRequestPayloads: (...args: unknown[]) => mocks.createPayloads(...args),
  createCityDesignPersistenceSnapshot: (...args: unknown[]) => mocks.createPersistence(...args),
}));
vi.mock('../../logic/cityDesignOsm', () => ({
  getCityDesignOsmLayerVisibility: (value: unknown) => value ?? { roads: true },
  isCityDesignFallbackSnapshot: () => mocks.fallbackSnapshot,
}));
vi.mock('../../logic/cityDesignSelectionAddress', () => ({
  formatCityDesignSelectionAddress: (_address: unknown, label: string | undefined) =>
    label ?? 'selection-label',
}));
vi.mock('../../logic/cityDesignChangeRequests', () => ({
  formatCityDesignChangeRequestIdentifier: (request: any) => request.id,
  formatCityDesignChangeRequestTitle: (request: any) => request.title ?? 'Untitled request',
  getCityDesignChangeRequests: (value: unknown) => (Array.isArray(value) ? value : []),
  getCityDesignChangeRequestDiscussionId: (request: any) => `discussion:${request.id}`,
  isOpenCityDesignChangeRequest: (request: any) => request.status !== 'closed',
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (...args: unknown[]) => mocks.waitForClientApply(...args),
  serverConfirmed: (...args: unknown[]) => mocks.serverConfirmed(...args),
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ canVote: () => mocks.canVote }),
}));
vi.mock('@/features/app-tutorial/events', () => ({
  APP_TUTORIAL_OSM_LOAD_FAILED_ACTION: 'tutorial-osm-failed',
  reportAppTutorialAction: (...args: unknown[]) => mocks.reportTutorial(...args),
}));
vi.mock('@/features/app-tutorial/city-design-fixture', () => ({
  APP_TUTORIAL_CITY_DESIGN_ADDRESS: { formatted: 'Tutorial address' },
  APP_TUTORIAL_CITY_DESIGN_CENTER: { lat: 30, lon: 40 },
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION: { center: { lat: 30, lon: 40 } },
  createAppTutorialOsmSnapshot: () => {
    if (mocks.tutorialSnapshotError) throw new Error('tutorial snapshot failed');
    return { source: 'tutorial' };
  },
}));

import {
  cityDesignPageControllerInternals,
  useCityDesignPageController,
} from '../useCityDesignPageController';

const selection = {
  center: { lat: 10, lon: 20 },
  bbox: { south: 9, west: 19, north: 11, east: 21 },
};

function makeDesign(overrides: Record<string, unknown> = {}) {
  return {
    origin: { lat: 10, lon: 20 },
    mapSelection: selection,
    selectionAddress: { formatted: 'Selected address' },
    osmSnapshot: null,
    osmLayerVisibility: { roads: true },
    showStreetMarkings: true,
    comparisonMode: 'side-by-side',
    hiddenOsmWayIds: [],
    hiddenOsmFeatureIds: [],
    objects: [],
    currency: 'EUR',
    ...overrides,
  } as any;
}

function makeAmendmentState(overrides: Record<string, unknown> = {}) {
  return {
    amendment: null,
    amendmentDocsCollabs: null,
    amendmentProcess: null,
    documents: [],
    changeRequestsWithVotes: [],
    collaborators: [],
    primaryCityDesign: null,
    isLoading: false,
    ...overrides,
  } as any;
}

function setDocumentMode(mode: string, overrides: Record<string, unknown> = {}) {
  mocks.amendmentState = makeAmendmentState({
    amendment: {
      id: 'amendment',
      title: 'Safer street',
      document_id: 'document',
      created_by: { id: 'owner', name: 'Owner' },
      change_requests: [],
      ...overrides,
    },
    documents: [{ id: 'document', editing_mode: mode }],
  });
}

beforeEach(() => {
  mocks.auth = { user: null };
  mocks.preference = { displayCurrency: 'USD', isLoading: true };
  mocks.userState = { user: null };
  mocks.amendmentState = makeAmendmentState();
  mocks.access = {
    canEdit: false,
    canEditDirectly: false,
    canSuggestInternally: false,
    canSuggestInEvent: false,
    canChangeMode: false,
  };
  mocks.locationOrigin = null;
  mocks.persistedDesign = makeDesign({ mapSelection: null, showStreetMarkings: undefined });
  mocks.editor = {
    design: makeDesign(),
    state: { isDirty: false, placementDraft: null },
    replaceDesign: vi.fn(),
    updateMapContext: vi.fn(),
    updateSelectionAddress: vi.fn(),
    hideOsmWay: vi.fn(),
  };
  mocks.actions = {
    createCityDesignChangeRequests: vi.fn(() => ({ mutation: 'requests' })),
    createCityDesign: vi.fn(() => ({ mutation: 'create' })),
    finalizeInternalChangeRequestVote: vi.fn(),
    updateAmendment: vi.fn(),
    updateChangeRequest: vi.fn(),
    updateProcessBranch: vi.fn(),
    updateCityDesign: vi.fn(() => ({ mutation: 'update' })),
    voteOnChangeRequest: vi.fn(),
  };
  mocks.documentActions = { updateDocument: vi.fn() };
  mocks.overpass.mockReset().mockResolvedValue({ source: 'overpass' });
  mocks.fallbackSnapshot = false;
  mocks.canVote = false;
  mocks.reportTutorial.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.createPayloads.mockReset().mockReturnValue([{ operation: 'add' }]);
  mocks.createPersistence.mockReset().mockReturnValue({
    bbox: selection.bbox,
    center_lat: 10,
    center_lon: 20,
    osm_snapshot: null,
    design_state: '{}',
    currency: 'EUR',
    estimated_total_cost_minor: 0,
    cost_catalog_version: 'test',
    cost_summary: {},
  });
  mocks.waitForClientApply.mockReset().mockResolvedValue(undefined);
  mocks.serverConfirmed.mockReset().mockResolvedValue(undefined);
  mocks.tutorialSnapshotError = false;
});

afterEach(cleanup);

describe('useCityDesignPageController A04 branch accountability', () => {
  it('normalizes helper inputs and collaborator fallbacks', () => {
    const helpers = cityDesignPageControllerInternals;
    expect(helpers.originFromCenter({ lat: 1, lon: 2 }, 'Center')).toEqual({
      lat: 1,
      lon: 2,
      label: 'Center',
    });
    expect(helpers.originFromCenter({ lat: 1, lon: 2 })).toEqual({ lat: 1, lon: 2 });
    expect(helpers.isSameCenter({ lat: 1, lon: 2 }, { lat: 1, lon: 2 })).toBe(true);
    expect(helpers.isSameCenter({ lat: 1, lon: 2 }, { lat: 2, lon: 2 })).toBe(false);
    expect(helpers.isSameCenter({ lat: 1, lon: 2 }, { lat: 1, lon: 3 })).toBe(false);
    expect(helpers.getCityDesignDiscussionArray([{ id: 'discussion' }])).toHaveLength(1);
    expect(helpers.getCityDesignDiscussionArray(null)).toEqual([]);

    const collaborators = helpers.mapCityDesignCollaborators(
      [
        null,
        {
          id: 'row',
          status: 'active',
          role: { name: 'Editor', action_rights: ['edit'] },
          user: {
            id: 'user',
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
            avatar: 'avatar',
          },
        },
        { user: { id: 'viewer', name: 'Viewer' }, status: 'viewer' },
      ],
      { id: 'owner', email: 'owner@example.com' }
    );
    expect(collaborators.map(item => item.user.id)).toEqual(['owner', 'user', 'viewer']);
    expect(collaborators[0]?.user.name).toBe('owner@example.com');
    expect(helpers.mapCityDesignCollaborators([], { id: 'unknown' })[0]?.user.name).toBe(
      'Unknown User'
    );
    expect(helpers.mapCityDesignCollaborators(undefined, null)).toEqual([]);
    expect(helpers.normalizeCollaboratorStatus('owner')).toBe('owner');
    expect(helpers.normalizeCollaboratorStatus('admin')).toBe('admin');
    expect(helpers.normalizeCollaboratorStatus('collaborator')).toBe('collaborator');
    expect(helpers.normalizeCollaboratorStatus('member')).toBe('member');
    expect(helpers.normalizeCollaboratorStatus('viewer')).toBe('viewer');
    expect(helpers.normalizeCollaboratorStatus('active')).toBe('collaborator');
    expect(helpers.normalizeCollaboratorStatus('unknown', 'owner')).toBe('owner');
    expect(helpers.asRecord({ id: 1 })).toEqual({ id: 1 });
    expect(helpers.asRecord([])).toBeNull();
    expect(helpers.asRecord(null)).toBeNull();
    expect(helpers.getString('value')).toBe('value');
    expect(helpers.getString('')).toBeUndefined();
    expect(helpers.getString(1)).toBeUndefined();
  });

  it('returns safe read-only defaults and guards mutation handlers', async () => {
    const { result } = renderHook(() => useCityDesignPageController('amendment'));
    expect(result.current.readOnly).toBe(true);
    expect(result.current.showActionBars).toBe(false);
    expect(result.current.currentUserDisplayName).toBe('Anonymous');
    expect(result.current.placementMode).toBeNull();
    expect(result.current.placementPointCount).toBe(0);
    expect(result.current.showStreetMarkings).toBe(true);

    act(() => {
      result.current.onSelectedMapSelectionChange(selection as any);
      result.current.onSelectionAddressChange(undefined);
      result.current.hideOsmWay('way');
    });
    await act(async () => {
      await result.current.onLoadOsm();
      await result.current.onSave();
      await result.current.onModeChange('edit');
      await result.current.onChangeRequestVote('request', 'accept');
      await result.current.onChangeRequestFinalize('request');
      await result.current.onChangeRequestCommentSubmit('request', 'comment');
    });
    expect(mocks.editor.updateMapContext).not.toHaveBeenCalled();
    expect(mocks.overpass).not.toHaveBeenCalled();
  });

  it('loads map data, updates map context, and creates a direct design', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'USD', isLoading: false };
    mocks.userState = {
      user: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'user@example.com',
        avatar: 'avatar',
      },
    };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    mocks.locationOrigin = { lat: 50, lon: 8, label: 'Amendment address' };
    setDocumentMode('edit');

    const { result } = renderHook(() => useCityDesignPageController('amendment'));
    expect(result.current.readOnly).toBe(false);
    expect(result.current.currentUserDisplayName).toBe('Ada Lovelace');
    expect(result.current.existingCollaboratorIds).toContain('owner');

    const movedSelection = { ...selection, center: { lat: 11, lon: 21 } };
    act(() => {
      result.current.onSelectedMapSelectionChange(selection as any);
      result.current.onSelectedMapSelectionChange(movedSelection as any);
      result.current.onSelectionAddressChange({ formatted: 'Next' } as any);
      result.current.hideOsmWay('way');
    });
    expect(mocks.editor.updateMapContext).toHaveBeenNthCalledWith(
      1,
      selection,
      mocks.editor.design.selectionAddress,
      true
    );
    expect(mocks.editor.updateMapContext).toHaveBeenNthCalledWith(
      2,
      movedSelection,
      undefined,
      true
    );

    await act(async () => {
      await result.current.onLoadOsm();
      await result.current.onSave();
      await result.current.onModeChange('suggest_internal');
      await result.current.onChangeRequestTitleChange('request', '  New title  ');
      await result.current.onChangeRequestTitleChange('request', '   ');
    });
    expect(mocks.overpass).toHaveBeenCalledOnce();
    expect(mocks.actions.createCityDesign).toHaveBeenCalledOnce();
    expect(mocks.documentActions.updateDocument).toHaveBeenCalledWith({
      id: 'document',
      editing_mode: 'suggest_internal',
    });
    expect(mocks.actions.updateChangeRequest).toHaveBeenLastCalledWith({
      id: 'request',
      title: null,
    });
  });

  it('handles OSM failures and tutorial snapshots', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: { email: 'record@example.com' } };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    setDocumentMode('edit');

    const { result, rerender } = renderHook(() => useCityDesignPageController('amendment'));
    mocks.fallbackSnapshot = true;
    await act(async () => result.current.onLoadOsm());
    expect(mocks.toastError).toHaveBeenCalled();

    setDocumentMode('edit', { tutorial_run_id: 'tutorial' });
    mocks.editor.state.isDirty = true;
    mocks.editor.design.objects = [{ type: 'tree', geometry: { kind: 'path_corridor' } }];
    mocks.fallbackSnapshot = false;
    rerender();
    await act(async () => result.current.onLoadOsm());
    expect(mocks.overpass).toHaveBeenCalledOnce();
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'action',
      event: 'city-design.osm-loaded',
    });

    mocks.overpass.mockRejectedValueOnce('unknown failure');
    setDocumentMode('edit');
    rerender();
    await act(async () => result.current.onLoadOsm());
    expect(mocks.toastError).toHaveBeenCalledWith(
      'features.amendments.cityDesign.errors.loadOsmFailed',
      expect.anything()
    );
  });

  it('saves updates and suggestions, votes, finalizes, and persists comments', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: { first_name: '', last_name: '', email: 'record@example.com' } };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    setDocumentMode('edit', { title: null });
    mocks.amendmentState.primaryCityDesign = { id: 'design', design_state: '{}' };

    const { result, rerender } = renderHook(() => useCityDesignPageController('amendment'));
    await act(async () => result.current.onSave());
    expect(mocks.actions.updateCityDesign).toHaveBeenCalledOnce();

    setDocumentMode('suggest_internal');
    mocks.createPayloads.mockReturnValueOnce([]);
    rerender();
    await act(async () => result.current.onSave());
    expect(mocks.actions.createCityDesignChangeRequests).not.toHaveBeenCalled();
    mocks.createPayloads.mockReturnValueOnce([{ operation: 'replace' }]);
    await act(async () => result.current.onSave());
    expect(mocks.actions.createCityDesignChangeRequests).toHaveBeenCalledOnce();

    setDocumentMode('vote_event');
    mocks.canVote = true;
    rerender();
    await act(async () => result.current.onChangeRequestVote('request', 'reject'));
    expect(mocks.actions.voteOnChangeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ change_request_id: 'request', vote: 'reject' })
    );

    setDocumentMode('vote_internal');
    rerender();
    await act(async () => result.current.onChangeRequestFinalize('request'));
    expect(mocks.actions.finalizeInternalChangeRequestVote).toHaveBeenCalledWith({
      change_request_id: 'request',
    });

    setDocumentMode('edit', {
      change_requests: [{ id: 'known', title: 'Known', status: 'open' }],
      discussions: [{ id: 'discussion:known', comments: null }],
    });
    rerender();
    await act(async () => {
      await result.current.onChangeRequestCommentSubmit('known', '  Existing discussion  ');
      await result.current.onChangeRequestCommentSubmit('new', 'New discussion');
      await result.current.onChangeRequestCommentSubmit('new', '   ');
    });
    expect(mocks.actions.updateAmendment).toHaveBeenCalledTimes(2);
  });

  it('uses process-branch fallbacks for mode changes and discussions', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: null };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    const branch = {
      id: 'branch',
      document_id: 'branch-document',
      editing_mode: 'edit',
      editable: true,
      discussions: [],
      step_runs: [
        { event_id: null, status: null },
        { event_id: 'done-event', status: 'completed' },
        { event_id: 'active-event', status: null },
      ],
    };
    mocks.amendmentState = makeAmendmentState({
      amendment: { id: 'amendment', title: 'Title', event_id: 'amendment-event' },
      amendmentDocsCollabs: {
        current_process_run: {
          active_branch_id: 'branch',
          active_branch: branch,
          branches: [branch],
        },
      },
      amendmentProcess: { event_id: 'process-event' },
      documents: [],
    });

    const { result } = renderHook(() => useCityDesignPageController('amendment'));
    expect(result.current.collaborationDocumentId).toBe('branch-document');
    await act(async () => {
      await result.current.onModeChange('suggest_event');
      await result.current.onChangeRequestCommentSubmit('missing', 'Branch comment');
    });
    expect(mocks.actions.updateProcessBranch).toHaveBeenCalledWith({
      id: 'branch',
      editing_mode: 'suggest_event',
    });
    expect(mocks.actions.updateProcessBranch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'branch', discussions: expect.any(Array) })
    );
  });

  it('covers terminal, event-suggestion, selection, placement, and empty mode targets', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: null };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    setDocumentMode('suggest_event');
    mocks.amendmentState.changeRequestsWithVotes = [{ id: 'voted', status: 'open' }];
    mocks.editor.design = makeDesign({
      mapSelection: null,
      osmSnapshot: null,
      showStreetMarkings: undefined,
    });
    mocks.editor.state.placementDraft = {
      mode: 'path',
      type: 'tree',
      points: [
        { x: 1, z: 1 },
        { x: 2, z: 2 },
      ],
      start: { x: 1, z: 1 },
      preview: { x: 2, z: 2 },
    };

    const { result, rerender } = renderHook(() => useCityDesignPageController('amendment'));
    expect(result.current.mode).toBe('suggest_event');
    expect(result.current.readOnly).toBe(false);
    expect(result.current.canFinishPathPlacement).toBe(true);
    expect(result.current.showStreetMarkings).toBe(true);
    expect(result.current.streetChangeRequests).toHaveLength(1);

    setDocumentMode('approved');
    rerender();
    expect(result.current.mode).toBe('view');

    mocks.amendmentState = makeAmendmentState({ amendment: { id: 'amendment' } });
    rerender();
    await act(async () => result.current.onModeChange('edit'));
    expect(mocks.documentActions.updateDocument).not.toHaveBeenCalled();
  });

  it('reports tutorial load/save failures and both save error forms', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: null };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    setDocumentMode('edit', { tutorial_run_id: 'tutorial' });
    mocks.tutorialSnapshotError = true;

    const { result, rerender } = renderHook(() => useCityDesignPageController('amendment'));
    await act(async () => result.current.onLoadOsm());
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'action',
      event: 'tutorial-osm-failed',
    });

    mocks.tutorialSnapshotError = false;
    await act(async () => result.current.onSave());
    expect(mocks.reportTutorial).toHaveBeenCalledWith({
      type: 'mutation',
      event: 'city-design.saved',
    });

    setDocumentMode('suggest_internal', { tutorial_run_id: 'tutorial' });
    rerender();
    await act(async () => result.current.onSave());
    expect(mocks.actions.createCityDesignChangeRequests).toHaveBeenCalled();

    setDocumentMode('edit');
    mocks.actions.createCityDesign.mockImplementationOnce(() => {
      throw new Error('save boom');
    });
    rerender();
    await act(async () => result.current.onSave());
    expect(result.current.saveError).toBe('save boom');

    mocks.actions.createCityDesign.mockImplementationOnce(() => {
      throw 'unknown save failure';
    });
    await act(async () => result.current.onSave());
    expect(result.current.saveError).toBe('features.amendments.cityDesign.errors.saveFailed');
  });

  it('preserves unrelated discussions while appending an existing thread', async () => {
    mocks.auth = { user: { id: 'user', email: 'auth@example.com' } };
    mocks.preference = { displayCurrency: 'EUR', isLoading: false };
    mocks.userState = { user: null };
    mocks.access = {
      canEdit: true,
      canEditDirectly: true,
      canSuggestInternally: true,
      canSuggestInEvent: true,
      canChangeMode: true,
    };
    setDocumentMode('edit', {
      change_requests: [{ id: 'known', title: 'Known', status: 'open' }],
      discussions: [
        { id: 'other', comments: [] },
        { id: 'discussion:known', comments: [] },
      ],
    });

    const { result } = renderHook(() => useCityDesignPageController('amendment'));
    await act(async () => result.current.onChangeRequestCommentSubmit('known', 'Comment'));
    const payload = mocks.actions.updateAmendment.mock.calls[0]?.[0];
    expect(payload.discussions).toHaveLength(2);
  });
});
