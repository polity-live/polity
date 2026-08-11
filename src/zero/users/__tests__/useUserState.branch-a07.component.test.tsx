/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  responses: new Map<string, [unknown, { type: string }]>(),
  query: vi.fn((query?: { kind?: string }) =>
    query?.kind
      ? (mocks.responses.get(query.kind) ?? [undefined, { type: 'complete' }])
      : [undefined, { type: 'complete' }]
  ),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.query }));
vi.mock('../../queries', () => ({
  queries: {
    users: {
      current: () => ({ kind: 'current' }),
      byId: () => ({ kind: 'user' }),
      followers: () => ({ kind: 'followers' }),
      following: () => ({ kind: 'following' }),
      publicUsers: () => ({ kind: 'public' }),
      allUsers: () => ({ kind: 'all' }),
      wikiProfile: () => ({ kind: 'wiki' }),
      fullProfile: () => ({ kind: 'full' }),
      withGroupMemberships: () => ({ kind: 'memberships' }),
      searchableUsers: () => ({ kind: 'searchable' }),
    },
  },
}));

import { useUserState } from '../useUserState';

const allOptions = {
  userId: 'user-1',
  includePublicUsers: true,
  includeAllUsers: true,
  includeWikiProfile: true,
  includeFullProfile: true,
  includeGroupMemberships: true,
  includeSearchableUsers: true,
};

function setResponse(kind: string, data: unknown, type = 'complete') {
  mocks.responses.set(kind, [data, { type }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.responses.clear();
});

afterEach(cleanup);

describe('useUserState branch contract', () => {
  it('covers omitted options and all empty collection/count fallbacks', () => {
    setResponse('current', null);
    const { result } = renderHook(() => useUserState());

    expect(result.current).toEqual(
      expect.objectContaining({
        followers: [],
        following: [],
        followerCount: 0,
        followingCount: 0,
        publicUsers: [],
        allUsers: [],
        fullProfile: [],
        userWithGroupMemberships: [],
        searchableUsers: [],
        isLoading: false,
      })
    );
  });

  it('normalizes profile membership roles, existing fallbacks, null users, and sort priorities', () => {
    const memberships = [
      { id: 'legacy', membership_roles: [], role: { id: 'legacy-role', sort_order: 1 } },
      { id: 'empty', membership_roles: null, role: null },
      {
        id: 'roles',
        membership_roles: [
          { role: null },
          { role: { id: 'low', sort_order: null } },
          { role: { id: 'high', sort_order: 10 } },
          { role: { id: 'middle', sort_order: 2 } },
        ],
      },
      {
        id: 'unordered',
        membership_roles: [
          { role: { id: 'unordered-a', sort_order: null } },
          { role: { id: 'unordered-b', sort_order: null } },
        ],
      },
    ];
    setResponse('current', { id: 'current' });
    setResponse('user', [{ id: 'user-1' }]);
    setResponse('followers', [{ id: 'follower' }]);
    setResponse('following', [{ id: 'following' }]);
    setResponse('public', [{ id: 'public' }]);
    setResponse('all', [{ id: 'all' }]);
    setResponse('wiki', { id: 'wiki' });
    setResponse('full', [null, { id: 'profile', group_memberships: memberships }]);
    setResponse('memberships', [{ id: 'profile-2', group_memberships: undefined }]);
    setResponse('searchable', [{ id: 'searchable' }]);

    const { result } = renderHook(() => useUserState(allOptions));

    expect(result.current.followerCount).toBe(1);
    expect(result.current.followingCount).toBe(1);
    expect(result.current.fullProfile[0]).toBeNull();
    const normalizedMemberships = result.current.fullProfile[1].group_memberships as unknown as {
      role: { id: string } | null;
    }[];
    expect(normalizedMemberships[0].role?.id).toBe('legacy-role');
    expect(normalizedMemberships[1].role).toBeNull();
    expect(normalizedMemberships[2].role?.id).toBe('high');
    expect(result.current.isLoading).toBe(false);
  });

  it('builds guarded profile queries when include flags are true without a user id', () => {
    setResponse('current', { id: 'current' });
    const { result } = renderHook(() =>
      useUserState({
        includeWikiProfile: true,
        includeFullProfile: true,
        includeGroupMemberships: true,
        includePublicUsers: false,
        includeAllUsers: false,
        includeSearchableUsers: false,
      })
    );
    expect(result.current.isLoading).toBe(false);
  });

  it.each(['current', 'user', 'public', 'all', 'wiki', 'full', 'memberships', 'searchable'])(
    'reports loading when the %s query is the first unknown dependency',
    kind => {
      for (const queryKind of [
        'current',
        'user',
        'public',
        'all',
        'wiki',
        'full',
        'memberships',
        'searchable',
      ]) {
        setResponse(queryKind, [], queryKind === kind ? 'unknown' : 'complete');
      }
      const { result } = renderHook(() => useUserState(allOptions));
      expect(result.current.isLoading).toBe(true);
    }
  );
});
