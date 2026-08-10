/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logic/messageUtils', () => ({
  getConversationDisplay: (conversation: Record<string, unknown>) => ({
    name: conversation.displayName ?? '',
    handle: conversation.displayHandle,
  }),
}));

vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantConversation: (conversation: Record<string, unknown>) =>
    conversation.assistant === true,
}));

import { sortConversations, useConversationFilters } from '../useConversationFilters';
import type { Conversation } from '../../types/message.types';

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    type: 'direct',
    pinned: false,
    last_message_at: 0,
    name: null,
    participants: [],
    messages: [],
    displayName: '',
    displayHandle: null,
    assistant: false,
    ...overrides,
  } as unknown as Conversation;
}

describe('sortConversations', () => {
  it('places pinned conversations first', () => {
    const pinned = conversation({ pinned: true });
    const normal = conversation({ pinned: false });
    expect(sortConversations(pinned, normal)).toBe(-1);
    expect(sortConversations(normal, pinned)).toBe(1);
  });

  it('orders equally pinned conversations by timestamp with zero fallbacks', () => {
    expect(
      sortConversations(
        conversation({ last_message_at: 10 }),
        conversation({ last_message_at: 20 })
      )
    ).toBe(10);
    expect(
      sortConversations(
        conversation({ last_message_at: null }),
        conversation({ last_message_at: null })
      )
    ).toBe(0);
  });
});

describe('useConversationFilters', () => {
  const conversations = [
    conversation({ id: 'group', type: 'group', last_message_at: 1 }),
    conversation({ id: 'event', type: 'event', last_message_at: 2 }),
    conversation({ id: 'ai', type: 'direct', assistant: true, last_message_at: 3 }),
    conversation({ id: 'direct', type: 'direct', last_message_at: 4 }),
  ];

  it.each([
    ['all', ['direct', 'ai', 'event', 'group']],
    ['group', ['group']],
    ['event', ['event']],
    ['ai', ['ai']],
    ['direct', ['direct']],
  ] as const)('filters the %s conversation category', (filter, expectedIds) => {
    const { result } = renderHook(() => useConversationFilters(conversations, 'user-1'));
    act(() => result.current.setConversationFilter(filter));
    expect(result.current.filteredConversations.map(item => item.id)).toEqual(expectedIds);
  });

  it('matches normalized text across display, conversation, participants, and messages', () => {
    const searchable = [
      conversation({ id: 'display-name', displayName: 'TARGET Name' }),
      conversation({ id: 'display-handle', displayName: 'Other', displayHandle: '@target' }),
      conversation({
        id: 'conversation-name',
        displayName: 'Other',
        displayHandle: null,
        name: 'Target room',
      }),
      conversation({
        id: 'participant-name',
        displayName: 'Other',
        participants: [{ user: { first_name: 'Target', last_name: null, handle: null } }],
      }),
      conversation({
        id: 'participant-handle',
        displayName: 'Other',
        participants: [{ user: { first_name: null, last_name: 'Other', handle: '@target' } }],
      }),
      conversation({
        id: 'message',
        displayName: 'Other',
        participants: [{ user: undefined }],
        messages: [{ content: null }, { content: 'A target message' }],
      }),
      conversation({
        id: 'no-match',
        displayName: 'Other',
        messages: [{ content: null }],
      }),
    ];
    const { result } = renderHook(() => useConversationFilters(searchable, 'user-1'));

    act(() => result.current.setSearchQuery('  TaRgEt  '));

    expect(result.current.searchQuery).toBe('  TaRgEt  ');
    expect(result.current.filteredConversations.map(item => item.id)).toEqual([
      'display-name',
      'display-handle',
      'conversation-name',
      'participant-name',
      'participant-handle',
      'message',
    ]);
  });

  it('keeps every conversation for a whitespace-only search query', () => {
    const { result } = renderHook(() => useConversationFilters(conversations));
    act(() => result.current.setSearchQuery('   '));
    expect(result.current.filteredConversations).toHaveLength(4);
  });
});
