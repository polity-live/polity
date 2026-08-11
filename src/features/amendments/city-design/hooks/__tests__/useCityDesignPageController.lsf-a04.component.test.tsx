/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const peers = [{ userId: 'peer-1', userName: 'Peer One' }];
const design = {
  origin: { lat: 52.5, lon: 13.4 },
  mapSelection: {
    center: { lat: 52.5, lon: 13.4 },
    bbox: { south: 52.4, west: 13.3, north: 52.6, east: 13.5 },
  },
  selectionAddress: undefined,
  osmSnapshot: null,
  osmLayerVisibility: { roads: true },
  showStreetMarkings: true,
  comparisonMode: 'overlay',
  hiddenOsmWayIds: [],
  hiddenOsmFeatureIds: [],
  objects: [],
  currency: 'EUR',
};
const editor = {
  design,
  state: { isDirty: false, placementDraft: null },
  replaceDesign: vi.fn(),
  updateMapContext: vi.fn(),
  updateSelectionAddress: vi.fn(),
  hideOsmWay: vi.fn(),
};

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/zero/preferences/usePreferenceState', () => ({
  usePreferenceState: () => ({ displayCurrency: 'EUR', isLoading: false }),
}));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => ({ user: null }) }));
vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({
    amendment: null,
    amendmentDocsCollabs: null,
    amendmentProcess: null,
    documents: [],
    changeRequestsWithVotes: [],
    collaborators: [],
    primaryCityDesign: null,
    isLoading: false,
  }),
}));
vi.mock('@/zero/amendments/useAmendmentActions', () => ({
  useAmendmentActions: () => ({
    createCityDesignChangeRequests: vi.fn(),
    createCityDesign: vi.fn(),
    finalizeInternalChangeRequestVote: vi.fn(),
    updateAmendment: vi.fn(),
    updateChangeRequest: vi.fn(),
    updateProcessBranch: vi.fn(),
    updateCityDesign: vi.fn(),
    voteOnChangeRequest: vi.fn(),
  }),
}));
vi.mock('@/zero/documents/useDocumentActions', () => ({
  useDocumentActions: () => ({ updateDocument: vi.fn() }),
}));
vi.mock('@/features/editor/hooks/useEditorPresence', () => ({
  useEditorPresence: () => ({ onlinePeers: peers, userColor: '#123456' }),
}));
vi.mock('@/features/editor/logic/editor-helpers', () => ({
  generateDistinctUserColorMap: () => new Map(),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/server/overpass-street-scene', () => ({ overpassStreetSceneFn: vi.fn() }));
vi.mock('@/features/amendments/logic/amendmentBranchDisplay', () => ({
  getBranchEditingMode: () => 'view',
  getBranchEditingModeDisabledReasons: () => [],
  isBranchEditable: () => false,
  resolveSelectedBranchId: () => null,
}));
vi.mock('@/zero/amendments/editing-mode-policy', () => ({
  isSuggestingMode: () => false,
  isTerminalEditingMode: () => false,
  isVotingMode: () => false,
  normalizeEditingMode: () => 'view',
}));
vi.mock('../useCityDesignEditorState', () => ({ useCityDesignEditorState: () => editor }));
vi.mock('../useCityDesignRemoteCursors', () => ({
  useCityDesignRemoteCursors: () => ({
    remoteCursors: [],
    activeCursorUserIds: new Set(),
    broadcastCursor: vi.fn(),
  }),
}));
vi.mock('../../logic/cityDesignPermissions', () => ({
  getCityDesignAccess: () => ({
    canEdit: false,
    canEditDirectly: false,
    canSuggestInternally: false,
    canSuggestInEvent: false,
    canChangeMode: false,
  }),
}));
vi.mock('../../logic/cityDesignAmendmentLocation', () => ({
  getCityDesignOriginFromAmendmentLocation: () => null,
}));
vi.mock('../../logic/cityDesignBbox', () => ({
  createCityDesignMapSelectionFromBbox: () => design.mapSelection,
  createCityDesignMapSelectionFromCenterRadius: () => design.mapSelection,
  getCityDesignMapSelectionBoundingBox: (selection: typeof design.mapSelection) => selection.bbox,
}));
vi.mock('../../state/cityDesignReducer', () => ({
  parseStoredCityDesignState: () => null,
  createEmptyCityDesignState: () => design,
}));
vi.mock('../../logic/cityDesignChangeRequestDiff', () => ({
  createCityDesignChangeRequestPayloads: () => [],
  createCityDesignPersistenceSnapshot: () => ({}),
}));
vi.mock('../../logic/cityDesignOsm', () => ({
  getCityDesignOsmLayerVisibility: (value: unknown) => value,
  isCityDesignFallbackSnapshot: () => false,
}));
vi.mock('../../logic/cityDesignSelectionAddress', () => ({
  formatCityDesignSelectionAddress: () => 'Berlin',
}));
vi.mock('../../logic/cityDesignChangeRequests', () => ({
  formatCityDesignChangeRequestIdentifier: () => '',
  formatCityDesignChangeRequestTitle: () => '',
  getCityDesignChangeRequests: () => [],
  getCityDesignChangeRequestDiscussionId: () => '',
  isOpenCityDesignChangeRequest: () => true,
}));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: vi.fn(),
  serverConfirmed: vi.fn(),
}));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/zero/rbac/usePermissions', () => ({
  usePermissions: () => ({ canVote: () => false }),
}));
vi.mock('@/features/app-tutorial/events', () => ({
  APP_TUTORIAL_OSM_LOAD_FAILED_ACTION: 'failed',
  reportAppTutorialAction: vi.fn(),
}));
vi.mock('@/features/app-tutorial/city-design-fixture', () => ({
  APP_TUTORIAL_CITY_DESIGN_ADDRESS: {},
  APP_TUTORIAL_CITY_DESIGN_CENTER: { lat: 0, lon: 0 },
  APP_TUTORIAL_CITY_DESIGN_MAP_SELECTION: {},
  createAppTutorialOsmSnapshot: () => ({}),
}));

import { useCityDesignPageController } from '../useCityDesignPageController';

afterEach(cleanup);

describe('useCityDesignPageController LSF peer index', () => {
  it('indexes every online peer by user id', () => {
    const { result } = renderHook(() => useCityDesignPageController('amendment-1'));

    expect(result.current.onlinePeerMap.get('peer-1')).toBe(peers[0]);
  });
});
