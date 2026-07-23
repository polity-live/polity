/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ARIA_KAI_USER_ID } from '@/features/auth/constants';
import { useNewConversationDialogController } from '../useNewConversationDialogController';

const userState = vi.hoisted(() => ({
  publicUsers: [] as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    handle: string | null;
  }[],
  user: undefined as
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        handle: string | null;
      }
    | undefined,
}));

vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => userState,
}));

const baseOptions = {
  open: true,
  currentUserId: 'current-user',
  existingConversationUserIds: [] as string[],
};

describe('useNewConversationDialogController', () => {
  beforeEach(() => {
    userState.publicUsers = [
      { id: 'named-user', first_name: 'Vyb', last_name: 'Shetty', handle: 'vyb' },
      { id: 'other-user', first_name: 'Other', last_name: 'User', handle: 'other' },
    ];
    userState.user = undefined;
  });

  it('returns a nameless target user by UUID without relying on name or handle', () => {
    userState.user = {
      id: 'nameless-user',
      first_name: null,
      last_name: null,
      handle: null,
    };

    const { result } = renderHook(() =>
      useNewConversationDialogController({
        ...baseOptions,
        initialSearchQuery: 'User',
        initialUserId: 'nameless-user',
      })
    );

    expect(result.current.isTargetedSearch).toBe(true);
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['nameless-user']);
  });

  it('continues to filter manual searches by name and handle', () => {
    const { result } = renderHook(() =>
      useNewConversationDialogController({
        ...baseOptions,
        initialSearchQuery: 'vyb',
      })
    );

    expect(result.current.isTargetedSearch).toBe(false);
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['named-user']);
  });

  it.each([
    ['the current user', 'current-user'],
    ['Aria and Kai', ARIA_KAI_USER_ID],
    ['a user with an existing conversation', 'existing-user'],
  ])('excludes %s in UUID target mode', (_, targetUserId) => {
    userState.user = {
      id: targetUserId,
      first_name: 'Target',
      last_name: 'User',
      handle: 'target',
    };

    const { result } = renderHook(() =>
      useNewConversationDialogController({
        ...baseOptions,
        existingConversationUserIds: targetUserId === 'existing-user' ? ['existing-user'] : [],
        initialUserId: targetUserId,
      })
    );

    expect(result.current.filteredUsers).toEqual([]);
  });

  it('returns no result for an unavailable UUID', () => {
    const { result } = renderHook(() =>
      useNewConversationDialogController({
        ...baseOptions,
        initialUserId: 'missing-user',
      })
    );

    expect(result.current.filteredUsers).toEqual([]);
  });
});
