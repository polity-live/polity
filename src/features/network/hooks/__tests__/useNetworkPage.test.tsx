/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useGroupNetworkMock = vi.fn();
const useGroupDataMock = vi.fn();
const useGroupConnectionActionsMock = vi.fn();
const useWorkflowActionsMock = vi.fn();
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
  useGroupConnectionActions: (...args: unknown[]) => useGroupConnectionActionsMock(...args),
  useWorkflowActions: (...args: unknown[]) => useWorkflowActionsMock(...args),
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
import type { NetworkTab } from '../../types/network.types';

function createRelationship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    connection_id: 'connection-1',
    grant_id: 'right-1',
    connection_request_id: 'request-1',
    membership_request_id: null,
    request_item_kind: 'right',
    group_id: 'group-a',
    related_group_id: 'group-b',
    relationship_type: 'parent',
    connection_type: 'hierarchy',
    parent_group_id: 'group-a',
    child_group_id: 'group-b',
    with_right: 'informationRight',
    status: 'requested',
    initiator_group_id: 'group-a',
    created_at: 1,
    member_source_group_id: null,
    member_target_group_id: null,
    membership_mode: 'none',
    required_source_role_id: null,
    eligible_origin_group_ids: [],
    group: null,
    related_group: null,
    ...overrides,
  };
}

function createWorkflow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Workflow ${id}`,
    group_id: 'final-group',
    start_group_id: 'start-group',
    status: 'active',
    approvals: [],
    steps: [],
    ...overrides,
  };
}

beforeEach(() => {
  useGroupNetworkMock.mockReset();
  useGroupDataMock.mockReset();
  useGroupConnectionActionsMock.mockReset();
  useWorkflowActionsMock.mockReset();
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
    groupConnections: [],
    isLoading: false,
  });
  useGroupDataMock.mockReturnValue({
    group: { id: 'group-1', name: 'Current Group' },
  });
  useGroupConnectionActionsMock.mockReturnValue({
    approveGroupConnectionRequest: vi.fn(),
    rejectGroupConnectionRequest: vi.fn(),
    deleteGroupConnection: vi.fn(),
  });
  useAllGroupsMock.mockReturnValue({ groups: [] });
  useAuthMock.mockReturnValue({ user: null });
  useWorkflowActionsMock.mockReturnValue({
    approveWorkflowApproval: vi.fn(),
    rejectWorkflowApproval: vi.fn(),
  });
  useWorkflowEditorMock.mockReturnValue({
    workflows: [],
    allWorkflows: [],
    isLoading: false,
    isEditorOpen: false,
    editingWorkflow: null,
    draftStartGroupId: '',
    setDraftStartGroupId: vi.fn(),
    draftName: '',
    setDraftName: vi.fn(),
    draftDescription: '',
    setDraftDescription: vi.fn(),
    draftIsDefaultEntry: false,
    setDraftIsDefaultEntry: vi.fn(),
    draftSteps: [],
    openNewWorkflow: vi.fn(),
    openEditWorkflow: vi.fn(),
    closeEditor: vi.fn(),
    addDraftStep: vi.fn(),
    updateDraftStep: vi.fn(),
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
  it('uses and updates a requested network tab from route state', () => {
    const initialProps: { tab?: NetworkTab } = { tab: 'manage-network' };
    const { result, rerender } = renderHook(
      ({ tab }: { tab?: NetworkTab }) => useNetworkPage('group-1', tab),
      { initialProps }
    );

    expect(result.current.activeTab).toBe('manage-network');

    act(() => {
      rerender({ tab: 'manage-workflows' });
    });

    expect(result.current.activeTab).toBe('manage-workflows');
  });

  it('includes the current page group in availableGroups when the global group list omits it', () => {
    useGroupDataMock.mockReturnValue({
      group: {
        id: 'group-1',
        name: 'Current Group',
        description: 'Current group description',
        group_type: 'policy',
        member_count: 4,
        event_count: 2,
        amendment_count: 1,
      },
    });
    useAllGroupsMock.mockReturnValue({
      groups: [
        {
          id: 'group-2',
          name: 'Another Group',
          description: 'Another group description',
          group_type: 'policy',
          member_count: 8,
          event_count: 5,
          amendment_count: 3,
        },
      ],
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    expect(result.current.availableGroups).toEqual([
      expect.objectContaining({
        id: 'group-2',
        name: 'Another Group',
      }),
      expect.objectContaining({
        id: 'group-1',
        name: 'Current Group',
      }),
    ]);
  });

  it('approves only the selected right ids for each request', async () => {
    const approveGroupConnectionRequest = vi.fn(() => 'approve-result');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest,
      rejectGroupConnectionRequest: vi.fn(),
      deleteGroupConnection: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleAcceptRequest([
        createRelationship({
          id: 'rel-1',
          connection_request_id: 'request-1',
          grant_id: 'right-1',
        }),
        createRelationship({
          id: 'rel-2',
          connection_request_id: 'request-1',
          grant_id: 'right-2',
          with_right: 'amendmentRight',
        }),
      ] as never);
    });

    expect(approveGroupConnectionRequest).toHaveBeenCalledWith({
      id: 'request-1',
      grant_request_ids: ['right-1', 'right-2'],
      approve_membership: false,
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('approve-result');
  });

  it('approves membership rows without selecting rights', async () => {
    const approveGroupConnectionRequest = vi.fn(() => 'approve-membership-result');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest,
      rejectGroupConnectionRequest: vi.fn(),
      deleteGroupConnection: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleAcceptRequest([
        createRelationship({
          id: 'membership-request-1',
          grant_id: null,
          membership_request_id: 'membership-request-1',
          request_item_kind: 'membership',
          with_right: null,
          member_source_group_id: 'group-b',
          member_target_group_id: 'group-a',
          membership_mode: 'all_members',
        }),
      ] as never);
    });

    expect(approveGroupConnectionRequest).toHaveBeenCalledWith({
      id: 'request-1',
      grant_request_ids: [],
      approve_membership: true,
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('approve-membership-result');
  });

  it('keeps membership pending when a single right row is approved', async () => {
    const approveGroupConnectionRequest = vi.fn(() => 'approve-right-result');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest,
      rejectGroupConnectionRequest: vi.fn(),
      deleteGroupConnection: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleAcceptRequest([
        createRelationship({
          id: 'grant-request-1',
          connection_request_id: 'request-1',
          grant_id: 'grant-request-1',
          request_item_kind: 'right',
          member_source_group_id: 'group-b',
          member_target_group_id: 'group-a',
          membership_mode: 'all_members',
        }),
      ] as never);
    });

    expect(approveGroupConnectionRequest).toHaveBeenCalledWith({
      id: 'request-1',
      grant_request_ids: ['grant-request-1'],
      approve_membership: false,
    });
  });

  it('rejects only the selected right ids for each request', async () => {
    const rejectGroupConnectionRequest = vi.fn(() => 'reject-result');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest: vi.fn(),
      rejectGroupConnectionRequest,
      deleteGroupConnection: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleRejectRequest([
        createRelationship({
          id: 'rel-1',
          connection_request_id: 'request-1',
          grant_id: 'right-1',
        }),
      ] as never);
    });

    expect(rejectGroupConnectionRequest).toHaveBeenCalledWith({
      id: 'request-1',
      grant_request_ids: ['right-1'],
      reject_membership: false,
      reject_structure: false,
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('reject-result');
  });

  it('rejects membership rows without rejecting rights or structure', async () => {
    const rejectGroupConnectionRequest = vi.fn(() => 'reject-membership-result');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest: vi.fn(),
      rejectGroupConnectionRequest,
      deleteGroupConnection: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleRejectRequest([
        createRelationship({
          id: 'membership-request-1',
          grant_id: null,
          membership_request_id: 'membership-request-1',
          request_item_kind: 'membership',
          with_right: null,
          member_source_group_id: 'group-b',
          member_target_group_id: 'group-a',
          membership_mode: 'all_members',
        }),
      ] as never);
    });

    expect(rejectGroupConnectionRequest).toHaveBeenCalledWith({
      id: 'request-1',
      grant_request_ids: [],
      reject_membership: true,
      reject_structure: false,
    });
    expect(serverConfirmedMock).toHaveBeenCalledWith('reject-membership-result');
  });

  it('deletes matching relationships from the current page group as acting group', async () => {
    const deleteGroupConnection = vi
      .fn()
      .mockReturnValueOnce('delete-result-1')
      .mockReturnValueOnce('delete-result-2');
    useGroupConnectionActionsMock.mockReturnValue({
      approveGroupConnectionRequest: vi.fn(),
      rejectGroupConnectionRequest: vi.fn(),
      deleteGroupConnection,
    });
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
      groupConnections: [
        { id: 'connection-1', group_a_id: 'group-1', group_b_id: 'group-2' },
        { id: 'connection-2', group_a_id: 'group-2', group_b_id: 'group-1' },
        { id: 'connection-other', group_a_id: 'group-1', group_b_id: 'group-3' },
      ],
      isLoading: false,
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    await act(async () => {
      await result.current.handleDeleteRelationship('group-2');
    });

    expect(deleteGroupConnection).toHaveBeenCalledTimes(2);
    expect(deleteGroupConnection).toHaveBeenNthCalledWith(1, {
      id: 'connection-1',
      acting_group_id: 'group-1',
    });
    expect(deleteGroupConnection).toHaveBeenNthCalledWith(2, {
      id: 'connection-2',
      acting_group_id: 'group-1',
    });
    expect(serverConfirmedMock).toHaveBeenNthCalledWith(1, 'delete-result-1');
    expect(serverConfirmedMock).toHaveBeenNthCalledWith(2, 'delete-result-2');
  });

  it('groups structure, membership, and right request rows under one outgoing request', () => {
    const currentGroup = { id: 'group-1', name: 'Current Group' };
    const partnerGroup = { id: 'group-2', name: 'Partner Group' };
    const structureRel = createRelationship({
      id: 'request-1:structure',
      connection_request_id: 'request-1',
      grant_id: null,
      membership_request_id: null,
      request_item_kind: 'structure',
      group_id: 'group-1',
      related_group_id: 'group-2',
      parent_group_id: 'group-1',
      child_group_id: 'group-2',
      with_right: null,
      initiator_group_id: 'group-1',
      member_source_group_id: 'group-2',
      member_target_group_id: 'group-1',
      membership_mode: 'all_members',
      group: currentGroup,
      related_group: partnerGroup,
    });
    const membershipRel = createRelationship({
      id: 'membership-request-1',
      connection_request_id: 'request-1',
      grant_id: null,
      membership_request_id: 'membership-request-1',
      request_item_kind: 'membership',
      group_id: 'group-2',
      related_group_id: 'group-1',
      parent_group_id: 'group-1',
      child_group_id: 'group-2',
      with_right: null,
      initiator_group_id: 'group-1',
      member_source_group_id: 'group-2',
      member_target_group_id: 'group-1',
      membership_mode: 'all_members',
      group: partnerGroup,
      related_group: currentGroup,
    });
    const grantRel = createRelationship({
      id: 'grant-request-1',
      connection_request_id: 'request-1',
      grant_id: 'grant-request-1',
      membership_request_id: null,
      request_item_kind: 'right',
      group_id: 'group-1',
      related_group_id: 'group-2',
      parent_group_id: 'group-1',
      child_group_id: 'group-2',
      with_right: 'amendmentRight',
      initiator_group_id: 'group-1',
      member_source_group_id: 'group-2',
      member_target_group_id: 'group-1',
      membership_mode: 'all_members',
      group: currentGroup,
      related_group: partnerGroup,
    });

    useGroupNetworkMock.mockReturnValue({
      networkData: { parents: [], children: [], siblings: [] },
      showIndirect: false,
      setShowIndirect: vi.fn(),
      selectedRights: new Set(),
      toggleRight: vi.fn(),
      activeRelationships: [],
      incomingRequests: [],
      outgoingRequests: [structureRel, membershipRel, grantRel],
      allRelationships: [structureRel, membershipRel, grantRel],
      groupConnections: [],
      isLoading: false,
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    expect(result.current.outgoingRequestCount).toBe(1);
    expect(result.current.filteredOutgoing).toHaveLength(1);
    expect(result.current.filteredOutgoing[0]).toMatchObject({
      requestId: 'request-1',
      allRels: [structureRel, membershipRel, grantRel],
      rightRels: [grantRel],
      membershipRels: [membershipRel],
      structureRel,
      rels: [membershipRel, grantRel],
      membershipMode: 'all_members',
    });
  });

  it('derives workflow buckets from participant approvals instead of final ownership only', () => {
    const incomingWorkflow = createWorkflow('incoming', {
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-incoming',
          group_id: 'group-1',
          status: 'pending',
          requested_by_group_id: 'group-2',
        },
      ],
    });

    const outgoingWorkflow = createWorkflow('outgoing', {
      status: 'pending_approval',
      approvals: [
        {
          id: 'approval-outgoing-self',
          group_id: 'group-1',
          status: 'accepted',
          requested_by_group_id: 'group-1',
        },
        {
          id: 'approval-outgoing-other',
          group_id: 'group-3',
          status: 'pending',
          requested_by_group_id: 'group-1',
        },
      ],
    });

    const activeCoOwnedWorkflow = createWorkflow('active-co-owned', {
      group_id: 'foreign-final-group',
      status: 'active',
      approvals: [
        {
          id: 'approval-active',
          group_id: 'group-1',
          status: 'accepted',
          requested_by_group_id: 'group-4',
        },
      ],
    });

    useWorkflowEditorMock.mockReturnValue({
      workflows: [incomingWorkflow, outgoingWorkflow, activeCoOwnedWorkflow],
      allWorkflows: [],
      isLoading: false,
      isEditorOpen: false,
      editingWorkflow: null,
      draftStartGroupId: '',
      setDraftStartGroupId: vi.fn(),
      draftName: '',
      setDraftName: vi.fn(),
      draftDescription: '',
      setDraftDescription: vi.fn(),
      draftIsDefaultEntry: false,
      setDraftIsDefaultEntry: vi.fn(),
      draftSteps: [],
      openNewWorkflow: vi.fn(),
      openEditWorkflow: vi.fn(),
      closeEditor: vi.fn(),
      addDraftStep: vi.fn(),
      updateDraftStep: vi.fn(),
      removeDraftStep: vi.fn(),
      moveDraftStep: vi.fn(),
      saveWorkflow: vi.fn(),
      deleteWorkflow: vi.fn(),
    });

    const { result } = renderHook(() => useNetworkPage('group-1'));

    expect(result.current.workflowIncomingRequests).toEqual([incomingWorkflow]);
    expect(result.current.workflowOutgoingRequests).toEqual([outgoingWorkflow]);
    expect(result.current.workflowActiveRelevant).toEqual([activeCoOwnedWorkflow]);
  });
});
