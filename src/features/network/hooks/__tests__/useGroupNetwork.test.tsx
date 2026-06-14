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
});
