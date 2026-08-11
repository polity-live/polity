/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const messageState = vi.hoisted(() => ({
  conversationsWithRelations: undefined as unknown[] | undefined,
  isLoading: false,
  options: undefined as unknown,
}));

const userState = vi.hoisted(() => ({
  allUsers: [] as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    handle: string | null;
  }[],
  user: undefined as
    | { id: string; first_name: string | null; last_name: string | null; handle: string | null }
    | undefined,
}));

vi.mock('@/zero/messages/useMessageState', () => ({
  useMessageState: (options: unknown) => {
    messageState.options = options;
    return messageState;
  },
}));

vi.mock('@/zero/users/useUserState', () => ({ useUserState: () => userState }));

import { useConversationData } from '../useConversationData';
import { useNewConversationDialogController } from '../useNewConversationDialogController';

describe('conversation data branch remainder', () => {
  beforeEach(() => {
    messageState.conversationsWithRelations = undefined;
    messageState.isLoading = false;
    userState.allUsers = [];
    userState.user = undefined;
  });

  it('uses the default cursor and returns no conversations without a user', () => {
    messageState.conversationsWithRelations = [{ id: 'ignored', participants: [] }];
    messageState.isLoading = true;

    const { result } = renderHook(() => useConversationData());

    expect(messageState.options).toEqual({ includeRelations: true, limit: 20 });
    expect(result.current).toEqual({ conversations: [], isLoading: true, pageInfo: undefined });
  });

  it('filters absent and loaded relations with an explicit cursor', () => {
    const first = renderHook(() => useConversationData('current', { first: 7, after: 'cursor' }));
    expect(first.result.current.conversations).toEqual([]);
    expect(messageState.options).toEqual({ includeRelations: true, limit: 7 });
    first.unmount();

    messageState.conversationsWithRelations = [
      { id: 'missing-participants' },
      { id: 'other', participants: [{ user_id: 'other' }] },
      { id: 'match', participants: [{ user_id: 'current' }] },
    ];
    const loaded = renderHook(() => useConversationData('current', { first: 3 }));
    expect(loaded.result.current.conversations).toEqual([expect.objectContaining({ id: 'match' })]);
  });

  it('keeps closed dialogs unchanged and searches users without handles', () => {
    userState.allUsers = [
      { id: 'nameless', first_name: null, last_name: null, handle: null },
      { id: 'ada', first_name: 'Ada', last_name: 'Lovelace', handle: null },
    ];
    const { result } = renderHook(() =>
      useNewConversationDialogController({
        open: false,
        currentUserId: 'current',
        initialSearchQuery: 'ignored',
        existingConversationUserIds: [],
      })
    );

    expect(result.current.userSearchQuery).toBe('');
    expect(result.current.filteredUsers).toHaveLength(2);
    act(() => result.current.onUserSearchQueryChange('missing'));
    expect(result.current.filteredUsers).toEqual([]);
    act(() => result.current.onUserSearchQueryChange('ada'));
    expect(result.current.filteredUsers.map(user => user.id)).toEqual(['ada']);
  });
});
