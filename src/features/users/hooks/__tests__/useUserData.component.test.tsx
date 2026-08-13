// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const token = (key: string, args: unknown) => ({ key, args });

  return {
    useQuery: vi.fn(),
    byId: vi.fn((args: unknown) => token('queries.users.byId', args)),
    userHashtags: vi.fn((args: unknown) => token('queries.common.userHashtags', args)),
  };
});

vi.mock('@rocicorp/zero/react', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    users: {
      byId: mocks.byId,
    },
    common: {
      userHashtags: mocks.userHashtags,
    },
  },
}));

import { useUserData } from '../useUserData';

const complete = { type: 'complete' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useQuery.mockImplementation((query: { key?: string } | undefined) => {
    if (query?.key === 'queries.users.byId') {
      return [{ id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' }, complete];
    }
    if (query?.key === 'queries.common.userHashtags') {
      return [
        [
          { id: 'link-1', hashtag: { id: 'tag-1', tag: 'democracy' } },
          { id: 'link-2', hashtag: { id: 'tag-2', tag: 'science' } },
        ],
        complete,
      ];
    }
    return [undefined, complete];
  });
});

describe('useUserData', () => {
  it('composes the base user and hashtags from the two narrow named queries', () => {
    const { result } = renderHook(() => useUserData('user-1'));

    expect(mocks.byId).toHaveBeenCalledWith({ id: 'user-1' });
    expect(mocks.userHashtags).toHaveBeenCalledWith({ user_id: 'user-1' });
    expect(result.current.user).toMatchObject({
      id: 'user-1',
      first_name: 'Ada',
      user_hashtags: [
        { id: 'link-1', hashtag: { id: 'tag-1', tag: 'democracy' } },
        { id: 'link-2', hashtag: { id: 'tag-2', tag: 'science' } },
      ],
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('does not expose a partial user while either query is unknown', () => {
    mocks.useQuery.mockImplementation((query: { key?: string } | undefined) => {
      if (query?.key === 'queries.users.byId') {
        return [{ id: 'user-1', first_name: 'Ada' }, complete];
      }
      return [[], { type: 'unknown' }];
    });

    const { result } = renderHook(() => useUserData('user-1'));

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('returns the base user with an empty hashtag projection', () => {
    mocks.useQuery.mockImplementation((query: { key?: string } | undefined) => {
      if (query?.key === 'queries.users.byId') {
        return [{ id: 'user-1', first_name: 'Ada' }, complete];
      }
      return [[], complete];
    });

    const { result } = renderHook(() => useUserData('user-1'));

    expect(result.current.user?.user_hashtags).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns not found when the ACL-filtered base query yields no user', () => {
    mocks.useQuery.mockReturnValue([undefined, complete]);

    const { result } = renderHook(() => useUserData('private-user'));

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not start either query without a user id', () => {
    const { result } = renderHook(() => useUserData());

    expect(mocks.byId).not.toHaveBeenCalled();
    expect(mocks.userHashtags).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
