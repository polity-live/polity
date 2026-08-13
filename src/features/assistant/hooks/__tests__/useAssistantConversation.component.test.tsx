/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssistantConversation } from '../useAssistantConversation';

const mocks = vi.hoisted(() => ({ conversations: [] as any[], isLoading: false }));

vi.mock('@/zero/messages/useMessageState', () => ({
  useMessageState: () => ({
    conversationsWithRelations: mocks.conversations,
    isLoading: mocks.isLoading,
  }),
}));

beforeEach(() => {
  mocks.conversations = [];
  mocks.isLoading = false;
});

describe('useAssistantConversation', () => {
  it('selects the newest assistant conversation for the requested participant only', () => {
    mocks.conversations = [
      {
        id: 'assistant-old',
        assistant_for_user_id: 'user-1',
        participants: [{ user_id: 'user-1' }],
        created_at: 10,
      },
      {
        id: 'assistant-new',
        assistant_for_user_id: 'user-1',
        participants: [{ user_id: 'user-1' }],
        last_message_at: 30,
      },
      {
        id: 'assistant-other-user',
        assistant_for_user_id: 'user-2',
        participants: [{ user_id: 'user-2' }],
        last_message_at: 40,
      },
      { id: 'ordinary', participants: [{ user_id: 'user-1' }], last_message_at: 50 },
    ];
    const { result, rerender } = renderHook(({ userId }) => useAssistantConversation(userId), {
      initialProps: { userId: 'user-1' as string | undefined },
    });
    expect(result.current.assistantConversation?.id).toBe('assistant-new');
    expect(result.current.isLoading).toBe(false);
    rerender({ userId: undefined });
    expect(result.current.assistantConversation).toBeUndefined();
  });

  it('handles missing relations and every timestamp fallback', () => {
    mocks.conversations = null as any;
    mocks.isLoading = true;
    const empty = renderHook(() => useAssistantConversation('user-1'));
    expect(empty.result.current).toEqual({
      assistantConversation: undefined,
      isLoading: true,
    });
    empty.unmount();

    mocks.conversations = [
      {
        id: 'no-participants',
        assistant_for_user_id: 'user-1',
        participants: null,
      },
      {
        id: 'created-at',
        assistant_for_user_id: 'user-1',
        participants: [{ user_id: 'user-1' }],
        created_at: 20,
        last_message_at: null,
      },
      {
        id: 'no-timestamp',
        assistant_for_user_id: 'user-1',
        participants: [{ user_id: 'user-1' }],
        created_at: null,
        last_message_at: null,
      },
    ];

    const populated = renderHook(() => useAssistantConversation('user-1'));
    expect(populated.result.current.assistantConversation?.id).toBe('created-at');
    populated.unmount();

    mocks.conversations = [...mocks.conversations].reverse();
    const reverseOrder = renderHook(() => useAssistantConversation('user-1'));
    expect(reverseOrder.result.current.assistantConversation?.id).toBe('created-at');
  });
});
