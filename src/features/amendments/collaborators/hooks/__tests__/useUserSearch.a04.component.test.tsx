/* @vitest-environment jsdom */

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ users: null as any, isLoading: false }));

vi.mock('@/zero/amendments/useAmendmentState', () => ({
  useAmendmentState: () => ({ allUsers: mocks.users, isLoading: mocks.isLoading }),
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: () => 'Unknown user',
}));

import { useUserSearch } from '../useUserSearch';

describe('useUserSearch A04 branch accountability', () => {
  afterEach(() => {
    cleanup();
    mocks.users = null;
    mocks.isLoading = false;
  });

  it('falls back to an empty loading result', () => {
    mocks.isLoading = true;
    const { result } = renderHook(() => useUserSearch([]));
    expect(result.current.users).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('filters invalid and existing users and maps every display fallback', () => {
    mocks.users = [
      null,
      { id: '', first_name: 'Invalid' },
      { id: 'existing', first_name: 'Existing' },
      {
        id: 'full',
        first_name: 'Ada',
        last_name: 'Lovelace',
        handle: 'ada',
        avatar: 'avatar.png',
        email: 'ada@example.com',
      },
      {
        id: 'handle',
        first_name: null,
        last_name: null,
        handle: 'handle',
        avatar: null,
        email: null,
      },
      { id: 'unknown', first_name: '', last_name: '', handle: null },
    ];
    const { result } = renderHook(() => useUserSearch(['existing']));

    expect(result.current.users).toEqual([
      {
        id: 'full',
        name: 'Ada Lovelace',
        handle: 'ada',
        avatar: 'avatar.png',
        contactEmail: 'ada@example.com',
      },
      {
        id: 'handle',
        name: 'handle',
        handle: 'handle',
        avatar: undefined,
        contactEmail: undefined,
      },
      {
        id: 'unknown',
        name: 'Unknown user',
        handle: undefined,
        avatar: undefined,
        contactEmail: undefined,
      },
    ]);
  });

  it('handles individual first and last name parts', () => {
    mocks.users = [
      { id: 'first', first_name: 'First', last_name: null },
      { id: 'last', first_name: null, last_name: 'Last' },
    ];
    const { result } = renderHook(() => useUserSearch([]));
    expect(result.current.users.map(user => user.name)).toEqual(['First', 'Last']);
  });
});
