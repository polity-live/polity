/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedGroupRelationship } from '../../types/network.types';

const useGroupStateMock = vi.fn();
const useGroupConnectionStateMock = vi.fn();
const deriveNormalizedGroupRelationshipsMock = vi.fn();
const deriveNormalizedGroupConnectionRequestRowsMock = vi.fn();

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: (...args: unknown[]) => useGroupStateMock(...args),
}));

vi.mock('@/zero/network', () => ({
  useGroupConnectionState: (...args: unknown[]) => useGroupConnectionStateMock(...args),
}));

vi.mock('../../logic/groupConnectionDerived', () => ({
  deriveNormalizedGroupRelationships: (...args: unknown[]) =>
    deriveNormalizedGroupRelationshipsMock(...args),
  deriveNormalizedGroupConnectionRequestRows: (...args: unknown[]) =>
    deriveNormalizedGroupConnectionRequestRowsMock(...args),
}));

import { useGroupNetwork } from '../useGroupNetwork';

function groupStub(id: string, name: string): NonNullable<NormalizedGroupRelationship['group']> {
  return {
    id,
    name,
  } as NonNullable<NormalizedGroupRelationship['group']>;
}

function createRelationship(
  overrides: Partial<NormalizedGroupRelationship> & Pick<NormalizedGroupRelationship, 'id'>
): NormalizedGroupRelationship {
  const groupId = overrides.group_id ?? 'group-a';
  const relatedGroupId = overrides.related_group_id ?? 'group-b';
  const relationshipType = overrides.relationship_type ?? 'child';
  return {
    id: overrides.id,
    connection_id: overrides.connection_id ?? `connection:${overrides.id}`,
    grant_id:
      overrides.grant_id ?? (overrides.with_right === null ? null : `grant:${overrides.id}`),
    membership_request_id: overrides.membership_request_id ?? null,
    request_item_kind: overrides.request_item_kind ?? 'right',
    group_id: groupId,
    related_group_id: relatedGroupId,
    relationship_type: relationshipType,
    connection_type: overrides.connection_type ?? 'hierarchy',
    parent_group_id:
      overrides.parent_group_id ?? (relationshipType === 'parent' ? relatedGroupId : groupId),
    child_group_id:
      overrides.child_group_id ?? (relationshipType === 'parent' ? groupId : relatedGroupId),
    with_right: 'with_right' in overrides ? (overrides.with_right ?? null) : 'informationRight',
    status: overrides.status ?? 'active',
    initiator_group_id: overrides.initiator_group_id ?? 'group-a',
    created_at: overrides.created_at ?? 1,
    member_source_group_id: overrides.member_source_group_id ?? null,
    member_target_group_id: overrides.member_target_group_id ?? null,
    membership_mode: overrides.membership_mode ?? 'none',
    required_source_role_id: overrides.required_source_role_id ?? null,
    eligible_origin_group_ids: overrides.eligible_origin_group_ids ?? [],
    group: overrides.group ?? groupStub(groupId, 'Group A'),
    related_group: overrides.related_group ?? groupStub(relatedGroupId, 'Group B'),
    connection_request_id: overrides.connection_request_id ?? null,
  };
}

describe('useGroupNetwork', () => {
  beforeEach(() => {
    useGroupStateMock.mockReset();
    useGroupConnectionStateMock.mockReset();
    deriveNormalizedGroupRelationshipsMock.mockReset();
    deriveNormalizedGroupConnectionRequestRowsMock.mockReset();

    deriveNormalizedGroupRelationshipsMock.mockImplementation(
      (relationships: NormalizedGroupRelationship[]) => relationships
    );
    deriveNormalizedGroupConnectionRequestRowsMock.mockImplementation(
      (relationships: NormalizedGroupRelationship[]) => relationships
    );
  });

  it('uses global allLinks for indirect expansion while keeping requests scoped to the current group', () => {
    const activeAB = createRelationship({
      id: 'active-a-b',
      group_id: 'group-a',
      related_group_id: 'group-b',
      group: groupStub('group-a', 'Group A'),
      related_group: groupStub('group-b', 'Group B'),
    });
    const activeBC = createRelationship({
      id: 'active-b-c',
      group_id: 'group-b',
      related_group_id: 'group-c',
      group: groupStub('group-b', 'Group B'),
      related_group: groupStub('group-c', 'Group C'),
    });
    const requestAD = createRelationship({
      id: 'request-a-d',
      group_id: 'group-a',
      related_group_id: 'group-d',
      related_group: groupStub('group-d', 'Group D'),
      status: 'requested',
      connection_request_id: 'request-1',
      grant_id: 'right-1',
    });

    useGroupStateMock.mockReturnValue({
      group: groupStub('group-a', 'Group A'),
      isLoading: false,
    });
    useGroupConnectionStateMock.mockReturnValue({
      groupConnections: [activeAB],
      groupConnectionsLoading: false,
      groupConnectionRequests: [requestAD],
      groupConnectionRequestsLoading: false,
      allConnections: [activeAB, activeBC],
      allConnectionsLoading: false,
    });

    const { result } = renderHook(() => useGroupNetwork('group-a'));

    expect(result.current.networkData.children.map(child => child.group.id)).toEqual(['group-b']);
    expect(result.current.outgoingRequests.map(rel => rel.related_group_id)).toEqual(['group-d']);

    act(() => {
      result.current.setShowIndirect(true);
    });

    expect(result.current.networkData.children.map(child => child.group.id)).toEqual([
      'group-b',
      'group-c',
    ]);
    expect(
      result.current.networkData.children.find(child => child.group.id === 'group-c')?.parentId
    ).toBe('group-b');
    expect(result.current.allRelationships.map(rel => rel.id)).toEqual([
      'active-a-b',
      'active-b-c',
      'request-a-d',
    ]);
  });

  it('categorizes request directions and merges direct sibling metadata defensively', () => {
    const siblingBase = createRelationship({
      id: 'sibling-base',
      group_id: 'group-a',
      related_group_id: 'sibling',
      relationship_type: 'sibling',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      with_right: null,
      membership_mode: 'none',
      group: groupStub('group-a', 'Group A'),
      related_group: groupStub('sibling', 'Sibling'),
    });
    const siblingRole = {
      ...siblingBase,
      id: 'sibling-role',
      grant_id: 'sibling-role-grant',
      with_right: 'informationRight',
      membership_mode: 'role_members',
      required_source_role_id: 'role',
      required_source_role: { id: 'role', name: 'Role' },
    } as NormalizedGroupRelationship;
    const siblingDuplicate = {
      ...siblingRole,
      id: 'sibling-duplicate',
      grant_id: 'sibling-duplicate-grant',
      required_source_role: null,
    } as NormalizedGroupRelationship;
    const reverseSibling = createRelationship({
      id: 'reverse-sibling',
      group_id: 'reverse',
      related_group_id: 'group-a',
      relationship_type: 'sibling',
      connection_type: 'peer',
      parent_group_id: null,
      child_group_id: null,
      group: groupStub('reverse', 'Reverse'),
      related_group: groupStub('group-a', 'Group A'),
    });
    const missingSibling = {
      ...siblingBase,
      id: 'missing-sibling',
      related_group_id: 'missing',
      related_group: null,
    };
    const nullMetadata = {
      ...createRelationship({
        id: 'null-metadata',
        group_id: 'group-a',
        related_group_id: 'child',
        with_right: null,
        status: null,
        initiator_group_id: null,
        membership_mode: null as never,
        required_source_role_id: null,
        connection_request_id: null,
        group: null,
        related_group: null,
      }),
      relationship_type: null,
      required_source_role: null,
    } as unknown as NormalizedGroupRelationship;

    const outgoing = createRelationship({
      id: 'outgoing',
      status: 'requested',
      initiator_group_id: 'group-a',
    });
    const incoming = createRelationship({
      id: 'incoming',
      status: 'pending',
      initiator_group_id: 'other',
    });
    const ignoredStatus = createRelationship({ id: 'ignored-status', status: 'rejected' });
    const unrelated = createRelationship({
      id: 'unrelated',
      group_id: 'outside-a',
      related_group_id: 'outside-b',
      status: 'requested',
    });

    useGroupStateMock.mockReturnValue({ group: groupStub('group-a', 'Group A'), isLoading: false });
    useGroupConnectionStateMock.mockReturnValue({
      groupConnections: [
        siblingBase,
        siblingRole,
        siblingDuplicate,
        reverseSibling,
        missingSibling,
        nullMetadata,
      ],
      groupConnectionsLoading: false,
      groupConnectionRequests: [outgoing, incoming, ignoredStatus, unrelated],
      groupConnectionRequestsLoading: false,
      allConnections: [],
      allConnectionsLoading: false,
    });

    const { result } = renderHook(() => useGroupNetwork('group-a'));
    expect(result.current.outgoingRequests.map(rel => rel.id)).toEqual(['outgoing']);
    expect(result.current.incomingRequests.map(rel => rel.id)).toEqual(['incoming']);
    expect(result.current.activeRelationships).toHaveLength(6);
    expect(result.current.networkData.siblings).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({ id: 'sibling' }),
        rights: ['informationRight'],
        membershipMode: 'role_members',
        requiredSourceRoleId: 'role',
        requiredSourceRoleName: 'Role',
      }),
      expect.objectContaining({ group: expect.objectContaining({ id: 'reverse' }) }),
    ]);

    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.networkData.siblings).toEqual([]);
    act(() => result.current.toggleRight('informationRight'));
    expect(result.current.networkData.siblings).toHaveLength(2);
  });

  it('maps parent ancestry and upgrades a sibling that initially has no membership metadata', () => {
    const parent = createRelationship({
      id: 'parent-a',
      group_id: 'parent',
      related_group_id: 'group-a',
      group: groupStub('parent', 'Parent'),
      related_group: groupStub('group-a', 'Group A'),
    });
    const ancestor = createRelationship({
      id: 'ancestor-parent',
      group_id: 'ancestor',
      related_group_id: 'parent',
      group: groupStub('ancestor', 'Ancestor'),
      related_group: groupStub('parent', 'Parent'),
    });
    const siblingWithoutMode = {
      ...createRelationship({
        id: 'sibling-without-mode',
        relationship_type: 'sibling',
        connection_type: 'peer',
        parent_group_id: null,
        child_group_id: null,
        related_group_id: 'sibling-without-mode',
        related_group: groupStub('sibling-without-mode', 'Sibling without mode'),
      }),
      membership_mode: null,
    } as unknown as NormalizedGroupRelationship;
    const upgradedSibling = {
      ...siblingWithoutMode,
      id: 'upgraded-sibling',
      membership_mode: 'role_members',
      required_source_role_id: null,
      required_source_role: null,
    } as NormalizedGroupRelationship;
    const inactive = {
      ...createRelationship({ id: 'inactive' }),
      status: null,
    } as unknown as NormalizedGroupRelationship;
    const requestWithoutMetadata = {
      ...createRelationship({ id: 'request-without-metadata' }),
      status: null,
      initiator_group_id: null,
      membership_mode: null,
      group: null,
    } as unknown as NormalizedGroupRelationship;

    useGroupStateMock.mockReturnValue({ group: groupStub('group-a', 'Group A'), isLoading: false });
    useGroupConnectionStateMock.mockReturnValue({
      groupConnections: [],
      groupConnectionsLoading: false,
      groupConnectionRequests: [requestWithoutMetadata],
      groupConnectionRequestsLoading: false,
      allConnections: [parent, ancestor, siblingWithoutMode, upgradedSibling, inactive],
      allConnectionsLoading: false,
    });

    const { result } = renderHook(() => useGroupNetwork('group-a'));
    expect(result.current.activeRelationships).toHaveLength(4);
    expect(result.current.networkData.parents.map(item => item.group.id)).toEqual(['parent']);
    expect(result.current.networkData.siblings).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({ id: 'sibling-without-mode' }),
        membershipMode: 'role_members',
        requiredSourceRoleId: null,
        requiredSourceRoleName: null,
      }),
    ]);

    act(() => result.current.setShowIndirect(true));
    expect(result.current.networkData.parents.map(item => item.group.id)).toEqual([
      'parent',
      'ancestor',
    ]);
  });

  it('returns empty network data for an empty group id and reports every loading source', () => {
    useGroupStateMock.mockReturnValue({ group: null, isLoading: false });
    const baseConnectionState = {
      groupConnections: [],
      groupConnectionRequests: [],
      allConnections: [],
      groupConnectionsLoading: false,
      groupConnectionRequestsLoading: false,
      allConnectionsLoading: false,
    };
    useGroupConnectionStateMock.mockReturnValue(baseConnectionState);
    const { result, unmount } = renderHook(() => useGroupNetwork(''));
    expect(result.current.networkData).toEqual({ parents: [], children: [], siblings: [] });
    expect(result.current.isLoading).toBe(false);
    unmount();

    for (const loadingState of [
      { isGroupLoading: true },
      { groupConnectionsLoading: true },
      { groupConnectionRequestsLoading: true },
      { allConnectionsLoading: true },
    ]) {
      useGroupStateMock.mockReturnValue({
        group: null,
        isLoading: loadingState.isGroupLoading ?? false,
      });
      useGroupConnectionStateMock.mockReturnValue({ ...baseConnectionState, ...loadingState });
      const hook = renderHook(() => useGroupNetwork('group-a'));
      expect(hook.result.current.isLoading).toBe(true);
      hook.unmount();
    }
  });
});
