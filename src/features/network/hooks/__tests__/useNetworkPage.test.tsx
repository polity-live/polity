/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useGroupNetworkMock = vi.fn();
const useGroupDataMock = vi.fn();
const useNetworkLinkActionsMock = vi.fn();
const useAllGroupsMock = vi.fn();
const useAuthMock = vi.fn();
const useWorkflowEditorMock = vi.fn();
const useHierarchyLinkConflictsMock = vi.fn();
const useTranslationMock = vi.fn();
const serverConfirmedMock = vi.fn();

vi.mock('../useGroupNetwork', () => ({
  useGroupNetwork: (...args: unknown[]) => useGroupNetworkMock(...args),
}));

vi.mock('@/features/groups/hooks/useGroupData', () => ({
  useGroupData: (...args: unknown[]) => useGroupDataMock(...args),
}));

vi.mock('@/zero/network', () => ({
  useNetworkLinkActions: (...args: unknown[]) => useNetworkLinkActionsMock(...args),
}));

vi.mock('@/zero/groups/useGroupState', () => ({
  useAllGroups: (...args: unknown[]) => useAllGroupsMock(...args),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}));

vi.mock('../useWorkflowEditor', () => ({
  useWorkflowEditor: (...args: unknown[]) => useWorkflowEditorMock(...args),
}));

vi.mock('../useHierarchyLinkConflicts', () => ({
  useHierarchyLinkConflicts: (...args: unknown[]) => useHierarchyLinkConflictsMock(...args),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: (...args: unknown[]) => useTranslationMock(...args),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  serverConfirmed: (...args: unknown[]) => serverConfirmedMock(...args),
}));

import { useNetworkPage } from '../useNetworkPage';

function createRelationship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    network_link_id: 'link-1',
    network_link_right_id: 'right-1',
    network_link_request_id: 'request-1',
    group_id: 'group-a',
    related_group_id: 'group-b',
    relationship_type: 'parent',
    structural_relation: 'parent_child',
    with_right: 'informationRight',
    status: 'requested',
    initiator_group_id: 'group-a',
    created_at: 1,
    membership_mode: 'none',
    group: null,
    related_group: null,
    right_direction: 'forward',
    ...overrides,
  };
}

beforeEach(() => {
  useGroupNetworkMock.mockReset();
  useGroupDataMock.mockReset();
  useNetworkLinkActionsMock.mockReset();
  useAllGroupsMock.mockReset();
  useAuthMock.mockReset();
  useWorkflowEditorMock.mockReset();
  useHierarchyLinkConflictsMock.mockReset();
  useTranslationMock.mockReset();
  serverConfirmedMock.mockReset();

  useGroupNetworkMock.mockReturnValue({
    networkData: { parents: [], children: [], siblings: [] },
    showIndirect: false,
    setShowIndirect: vi.fn(),
    selectedRights: new Set(),
    toggleRight: vi.fn(),
    activeRelationships: [],
    incomingRequests: [],
    outgoingRequests: [],
    allRelationships: [],
    groupLinks: [],
    isLoading: false,
  });
  useGroupDataMock.mockReturnValue({
    group: { id: 'group-1', name: 'Current Group' },
  });
  useAllGroupsMock.mockReturnValue({ groups: [] });
  useAuthMock.mockReturnValue({ user: null });
  useWorkflowEditorMock.mockReturnValue({
    workflows: [],
    isLoading: false,
    isEditorOpen: false,
    editingWorkflow: null,
    draftName: '',
    setDraftName: vi.fn(),
    draftDescription: '',
    setDraftDescription: vi.fn(),
    draftSteps: [],
    openNewWorkflow: vi.fn(),
    openEditWorkflow: vi.fn(),
    closeEditor: vi.fn(),
    addDraftStep: vi.fn(),
    removeDraftStep: vi.fn(),
    moveDraftStep: vi.fn(),
    saveWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
  });
  useHierarchyLinkConflictsMock.mockReturnValue({
    canActivateLink: vi.fn(() => true),
  });
  useTranslationMock.mockReturnValue({
    t: (key: string) => key,
  });
  serverConfirmedMock.mockResolvedValue(undefined);
});

describe('useNetworkPage request actions', () => {
  it('approves only the selected right ids for each request', async () => {
    const approveNetworkLinkChangeRequest = vi.fn(() => 'approve-result');
    useNetworkLinkActionsMock.mockReturnValue({
      approveNetworkLinkChangeRequest,
      rejectNetworkLinkChangeRequest: vi.fn(),
      deleteNetworkLink: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleAcceptRequest([
        createRelationship({
          id: 'rel-1',
          network_link_request_id: 'request-1',
          network_link_right_id: 'right-1',
        }),
        createRelationship({
          id: 'rel-2',
          network_link_request_id: 'request-1',
          network_link_right_id: 'right-2',
          with_right: 'amendmentRight',
        }),
      ] as never);
    });

    expect(approveNetworkLinkChangeRequest).toHaveBeenCalledWith({
      id: 'request-1',
      right_ids: ['right-1', 'right-2'],
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('approve-result');
  });

  it('rejects only the selected right ids for each request', async () => {
    const rejectNetworkLinkChangeRequest = vi.fn(() => 'reject-result');
    useNetworkLinkActionsMock.mockReturnValue({
      approveNetworkLinkChangeRequest: vi.fn(),
      rejectNetworkLinkChangeRequest,
      deleteNetworkLink: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleRejectRequest([
        createRelationship({
          id: 'rel-1',
          network_link_request_id: 'request-1',
          network_link_right_id: 'right-1',
        }),
      ] as never);
    });

    expect(rejectNetworkLinkChangeRequest).toHaveBeenCalledWith({
      id: 'request-1',
      right_ids: ['right-1'],
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('reject-result');
  });
});
