/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  relationshipLinks: null as any,
  relationshipResult: { type: 'complete' } as any,
  rootMemberships: null as any,
  rootResult: { type: 'complete' } as any,
  resolve: vi.fn(({ memberships }: any) =>
    memberships.map((item: any) => ({ ...item, resolved: true }))
  ),
  buckets: vi.fn((memberships: any[]) => memberships.map(item => ({ id: item.id }))),
  derive: vi.fn((links: any[]) => links.map(link => ({ ...link, derived: true }))),
}));

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (query: any) => {
    if (query?.kind === 'relationships') return [mocks.relationshipLinks, mocks.relationshipResult];
    if (query?.kind === 'memberships') return [mocks.rootMemberships, mocks.rootResult];
    return [null, { type: 'complete' }];
  },
}));
vi.mock('@/zero/queries', () => ({
  queries: {
    network: { allGroupConnections: () => ({ kind: 'relationships' }) },
    groups: {
      membershipsWithRolesAndRightsByGroupIds: (args: unknown) => ({ kind: 'memberships', args }),
    },
  },
}));
vi.mock('../../logic/membershipComposition', () => ({
  supportsMembershipComposition: (group: any) => Boolean(group?.supported),
  resolveMembershipProvenance: mocks.resolve,
  buildMembershipCompositionBuckets: mocks.buckets,
}));
vi.mock('@/features/network/logic/groupConnectionDerived', () => ({
  deriveNormalizedGroupRelationships: mocks.derive,
}));

import {
  groupMembershipCompositionInternals as helpers,
  useGroupMembershipComposition,
} from '../useGroupMembershipComposition';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.relationshipLinks = null;
  mocks.relationshipResult = { type: 'complete' };
  mocks.rootMemberships = null;
  mocks.rootResult = { type: 'complete' };
});

describe('membership composition normalization', () => {
  it('selects the highest sorted role and handles absent sort orders', () => {
    expect(helpers.selectPrimaryGroupRole([])).toBeNull();
    const unsorted = [
      { id: 'unset-left', sort_order: null },
      { id: 'low', sort_order: 1 },
      { id: 'unset-right' },
      { id: 'high', sort_order: 5 },
    ];
    expect(helpers.selectPrimaryGroupRole(unsorted as any)).toMatchObject({ id: 'high' });
  });

  it('normalizes null data, missing links, null roles, and populated role links', () => {
    expect(helpers.normalizeMemberships(null)).toEqual([]);
    const normalized = helpers.normalizeMemberships([
      { id: 'empty', membership_roles: undefined },
      { id: 'roles', membership_roles: [{ role: null }, { role: { id: 'role', sort_order: 1 } }] },
    ] as any);
    expect(normalized[0]).toMatchObject({ roles: [], role: null });
    expect(normalized[1]).toMatchObject({ roles: [{ id: 'role' }], role: { id: 'role' } });
  });
});

describe('useGroupMembershipComposition', () => {
  it('returns memberships unchanged and no buckets when composition is unsupported', () => {
    const memberships = [{ id: 'membership', source_group_id: 'source' }];
    const { result } = renderHook(() => useGroupMembershipComposition(null, memberships as any));
    expect(result.current).toMatchObject({
      showComposition: false,
      membershipsWithProvenance: memberships,
      compositionBuckets: [],
      isLoading: false,
    });
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it('does not request root memberships for supported non-sibling groups', () => {
    const group = { id: 'hierarchy', group_type: 'hierarchical', supported: true };
    const memberships = [{ id: 'membership', source_group_id: 'source' }];
    const { result } = renderHook(() =>
      useGroupMembershipComposition(group as any, memberships as any)
    );
    expect(result.current.showComposition).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mocks.resolve).toHaveBeenCalled();
    expect(mocks.buckets).toHaveBeenCalled();
  });

  it('deduplicates valid sibling source IDs and resolves relationships and root memberships', () => {
    mocks.relationshipLinks = [{ id: 'relationship' }];
    mocks.rootMemberships = [
      {
        id: 'root',
        membership_roles: [
          { role: { id: 'low', sort_order: 1 } },
          { role: { id: 'high', sort_order: 2 } },
        ],
      },
    ];
    const group = { id: 'sibling', group_type: 'sibling', supported: true };
    const memberships = [
      { id: 'one', source_group_id: 'source' },
      { id: 'two', source_group_id: 'source' },
      { id: 'three', source_group_id: null },
    ];
    const { result } = renderHook(() =>
      useGroupMembershipComposition(group as any, memberships as any)
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.membershipsWithProvenance.every(item => (item as any).resolved)).toBe(
      true
    );
    expect(result.current.compositionBuckets).toHaveLength(3);
    expect(mocks.derive).toHaveBeenCalledWith([{ id: 'relationship' }]);
    expect(mocks.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        rootMemberships: [
          expect.objectContaining({ role: expect.objectContaining({ id: 'high' }) }),
        ],
      })
    );
  });

  it('stays unresolved while relationship or required root membership data is unknown', () => {
    const group = { id: 'sibling', group_type: 'sibling', supported: true };
    const memberships = [{ id: 'membership', source_group_id: 'source' }];
    mocks.relationshipResult = { type: 'unknown' };
    const relationshipsLoading = renderHook(() =>
      useGroupMembershipComposition(group as any, memberships as any)
    );
    expect(relationshipsLoading.result.current).toMatchObject({
      isLoading: true,
      compositionBuckets: [],
    });
    expect(relationshipsLoading.result.current.membershipsWithProvenance).toBe(memberships);

    mocks.relationshipResult = { type: 'complete' };
    mocks.rootResult = { type: 'unknown' };
    const rootsLoading = renderHook(() =>
      useGroupMembershipComposition(group as any, memberships as any)
    );
    expect(rootsLoading.result.current.isLoading).toBe(true);

    const noSources = renderHook(() => useGroupMembershipComposition(group as any, []));
    expect(noSources.result.current.isLoading).toBe(false);
  });
});
