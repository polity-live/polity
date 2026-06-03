/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedGroupRelationship } from '../../types/network.types';

const useGroupStateMock = vi.fn();
const useNetworkLinkStateMock = vi.fn();
const explodeNetworkLinksToRelationshipsMock = vi.fn();
const explodeNetworkLinkChangeRequestsToRelationshipsMock = vi.fn();

vi.mock('@/zero/groups/useGroupState', () => ({
  useGroupState: (...args: unknown[]) => useGroupStateMock(...args),
}));

vi.mock('@/zero/network', () => ({
  useNetworkLinkState: (...args: unknown[]) => useNetworkLinkStateMock(...args),
}));

vi.mock('../../logic/networkLinkDerived', () => ({
  explodeNetworkLinksToRelationships: (...args: unknown[]) =>
    explodeNetworkLinksToRelationshipsMock(...args),
  explodeNetworkLinkChangeRequestsToRelationships: (...args: unknown[]) =>
    explodeNetworkLinkChangeRequestsToRelationshipsMock(...args),
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
  return {
    id: overrides.id,
    group_id: overrides.group_id ?? 'group-a',
    related_group_id: overrides.related_group_id ?? 'group-b',
    relationship_type: overrides.relationship_type ?? 'child',
    with_right: 'with_right' in overrides ? (overrides.with_right ?? null) : 'informationRight',
    status: overrides.status ?? 'active',
    initiator_group_id: overrides.initiator_group_id ?? 'group-a',
    created_at: overrides.created_at ?? 1,
    membership_mode: overrides.membership_mode ?? 'none',
    group: overrides.group ?? groupStub(overrides.group_id ?? 'group-a', 'Group A'),
    related_group:
      overrides.related_group ?? groupStub(overrides.related_group_id ?? 'group-b', 'Group B'),
    network_link_request_id: overrides.network_link_request_id ?? null,
    network_link_right_id: overrides.network_link_right_id ?? null,
  } as NormalizedGroupRelationship;
}

describe('useGroupNetwork', () => {
  beforeEach(() => {
    useGroupStateMock.mockReset();
    useNetworkLinkStateMock.mockReset();
    explodeNetworkLinksToRelationshipsMock.mockReset();
    explodeNetworkLinkChangeRequestsToRelationshipsMock.mockReset();

    explodeNetworkLinksToRelationshipsMock.mockImplementation(
      (relationships: NormalizedGroupRelationship[]) => relationships
    );
    explodeNetworkLinkChangeRequestsToRelationshipsMock.mockImplementation(
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
      network_link_request_id: 'request-1',
      network_link_right_id: 'right-1',
    });

    useGroupStateMock.mockReturnValue({
      group: groupStub('group-a', 'Group A'),
      isLoading: false,
    });
    useNetworkLinkStateMock.mockReturnValue({
      groupLinks: [activeAB],
      groupLinksLoading: false,
      groupChangeRequests: [requestAD],
      groupChangeRequestsLoading: false,
      allLinks: [activeAB, activeBC],
      allLinksLoading: false,
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
