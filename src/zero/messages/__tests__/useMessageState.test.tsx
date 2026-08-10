/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = [unknown, { type: 'unknown' | 'complete' }];

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  useQuery: vi.fn(),
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: mocks.useQuery }));

vi.mock('../../queries', () => {
  const query = (name: string, args: unknown) => ({ key: `${name}:${JSON.stringify(args)}` });
  return {
    queries: {
      messages: {
        messagesWindow: (args: unknown) => query('messages', args),
        conversationById: (args: unknown) => query('conversation', args),
        unreadCount: (args: unknown) => query('unread', args),
        conversationsWithRelations: (args: unknown) => query('relations', args),
        conversationsForUnread: (args: unknown) => query('for-unread', args),
        conversationsByUserWithRelations: (args: unknown) => query('by-user', args),
        conversationByGroupId: (args: unknown) => query('by-group', args),
      },
    },
  };
});

import { useMessageState } from '../useMessageState';

function key(name: string, args: unknown) {
  return `${name}:${JSON.stringify(args)}`;
}

function setResult(name: string, args: unknown, value: unknown, type: 'unknown' | 'complete' = 'complete') {
  mocks.results.set(key(name, args), [value, { type }]);
}

beforeEach(() => {
  mocks.results.clear();
  mocks.useQuery.mockReset();
  mocks.useQuery.mockImplementation((query?: { key: string }) =>
    query ? (mocks.results.get(query.key) ?? [undefined, { type: 'complete' }]) : [undefined, { type: 'complete' }]
  );
});

describe('useMessageState', () => {
  it('returns stable empty defaults without an enabled scope', () => {
    expect(renderHook(() => useMessageState()).result.current).toEqual({
      messages: [],
      conversation: undefined,
      unread: [],
      conversationsWithRelations: [],
      conversationsForUnread: [],
      conversationsByUser: [],
      groupConversation: undefined,
      isLoading: false,
    });
    expect(mocks.useQuery.mock.calls.every(([query]) => query === undefined)).toBe(true);
  });

  it('returns all query data, reverses message windows, and removes empty unread rows', () => {
    setResult(
      'messages',
      { conversation_id: 'conversation-1', limit: 25 },
      [{ id: 'newest' }, { id: 'oldest' }]
    );
    setResult('conversation', { id: 'conversation-1' }, { id: 'conversation-1' });
    setResult('unread', { conversation_id: 'conversation-1' }, [{ count: 2 }]);
    setResult('relations', { limit: 5 }, [{ id: 'relations-1' }]);
    setResult('for-unread', {}, [
      { conversation: { id: 'unread-1' } },
      { conversation: null },
    ]);
    setResult('by-user', { user_id: 'user-1' }, [{ id: 'user-conversation-1' }]);
    setResult('by-group', { group_id: 'group-1' }, { id: 'group-conversation-1' });

    const state = renderHook(() =>
      useMessageState({
        conversationId: 'conversation-1',
        messageLimit: 25,
        includeRelations: true,
        limit: 5,
        includeForUnread: true,
        includeConversationsByUser: true,
        userId: 'user-1',
        groupId: 'group-1',
      })
    ).result.current;

    expect(state).toEqual({
      messages: [{ id: 'oldest' }, { id: 'newest' }],
      conversation: { id: 'conversation-1' },
      unread: [{ count: 2 }],
      conversationsWithRelations: [{ id: 'relations-1' }],
      conversationsForUnread: [{ id: 'unread-1' }],
      conversationsByUser: [{ id: 'user-conversation-1' }],
      groupConversation: { id: 'group-conversation-1' },
      isLoading: false,
    });
  });

  it('uses the default message window and ignores incomplete opt-in scopes', () => {
    renderHook(() =>
      useMessageState({
        conversationId: 'conversation-1',
        includeConversationsByUser: true,
        userId: '',
        groupId: '',
      })
    );

    expect(mocks.useQuery).toHaveBeenCalledWith({
      key: 'messages:{"conversation_id":"conversation-1","limit":80}',
    });
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it.each([
    ['messages', { conversationId: 'conversation-1' }, { conversation_id: 'conversation-1', limit: 80 }],
    ['conversation', { conversationId: 'conversation-1' }, { id: 'conversation-1' }],
    ['unread', { conversationId: 'conversation-1' }, { conversation_id: 'conversation-1' }],
    ['relations', { includeRelations: true }, { limit: undefined }],
    ['for-unread', { includeForUnread: true }, {}],
    [
      'by-user',
      { includeConversationsByUser: true, userId: 'user-1' },
      { user_id: 'user-1' },
    ],
    ['by-group', { groupId: 'group-1' }, { group_id: 'group-1' }],
  ] as const)('reports the %s loading boundary', (name, options, args) => {
    setResult(name, args, undefined, 'unknown');

    const state = renderHook(() => useMessageState(options)).result.current;

    expect(state.isLoading).toBe(true);
  });
});
