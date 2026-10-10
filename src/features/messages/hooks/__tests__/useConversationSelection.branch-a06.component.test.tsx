// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useConversationSelection } from '../useConversationSelection';

vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantConversation: (conversation: any) => conversation.assistant === true,
}));

function conversation(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    created_at: 1,
    last_message_at: null,
    messages: [],
    ...overrides,
  } as any;
}

afterEach(cleanup);

describe('useConversationSelection exhaustive branches', () => {
  it('opens an authorized local deep link on the first render without exposing an absent conversation', () => {
    window.history.replaceState(
      { polityMessageSelection: { viewerID: 'owner', conversationID: 'previous' } },
      '',
      '/messages'
    );
    const rows = [conversation('previous'), conversation('target')];
    const options = { restoreOnNavigation: true, viewerID: 'owner' };
    const renders: (string | null)[] = [];
    const linked = renderHook(() => {
      const selection = useConversationSelection(rows, {
        ...options,
        initialConversationID: 'target',
      });
      renders.push(selection.selectedConversationId);
      return selection;
    });
    expect(renders[0]).toBe('target');
    expect(linked.result.current.selectedConversation?.id).toBe('target');
    linked.unmount();
    window.history.replaceState({}, '', '/messages');
    const absent = renderHook(() =>
      useConversationSelection(rows, { ...options, initialConversationID: 'private-or-missing' })
    );
    expect(absent.result.current.selectedConversationId).toBeNull();
    expect(absent.result.current.selectedConversation).toBeUndefined();
    absent.unmount();
    window.history.replaceState({}, '', '/');
  });
  it('restores navigation selection for the same viewer while preserving router history state', () => {
    window.history.replaceState({ __TSR_index: 7 }, '', '/messages');
    const options = { restoreOnNavigation: true, viewerID: 'owner' };
    const first = renderHook(() => useConversationSelection([conversation('selected')], options));
    act(() => first.result.current.setSelectedConversationId('selected'));
    expect(window.history.state.__TSR_index).toBe(7);
    first.unmount();
    const restored = renderHook(() =>
      useConversationSelection([conversation('selected')], options)
    );
    expect(restored.result.current.selectedConversation?.id).toBe('selected');
    restored.unmount();
    const other = renderHook(() =>
      useConversationSelection([conversation('selected')], { ...options, viewerID: 'outsider' })
    );
    expect(other.result.current.selectedConversationId).toBeNull();
    other.unmount();
    window.history.replaceState({}, '', '/');
  });
  it('does not auto-select without an actionable assistant intent', () => {
    const { result, rerender } = renderHook(
      ({ conversations, options }) => useConversationSelection(conversations, options),
      { initialProps: { conversations: [] as any[], options: undefined as any } }
    );
    expect(result.current.selectedConversation).toBeUndefined();

    rerender({ conversations: [], options: { openAriaKai: true } });
    expect(result.current.selectedConversationId).toBeNull();
    rerender({
      conversations: [conversation('ordinary')],
      options: { openAriaKai: true },
    });
    expect(result.current.selectedConversationId).toBeNull();
  });

  it('selects the newest assistant once and strips the one-shot URL intent', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const conversations = [
      conversation('old', { assistant: true, created_at: 5 }),
      conversation('epoch', { assistant: true, created_at: null }),
      conversation('new', { assistant: true, last_message_at: 10 }),
      conversation('ordinary'),
    ];
    const { result, rerender } = renderHook(
      ({ rows }) => useConversationSelection(rows, { openAriaKai: true }),
      { initialProps: { rows: conversations } }
    );
    expect(result.current.selectedConversationId).toBe('new');
    expect(replaceState).toHaveBeenCalledWith(expect.any(Object), '', window.location.pathname);

    rerender({ rows: [conversation('later', { assistant: true, last_message_at: 20 })] });
    expect(result.current.selectedConversationId).toBe('new');
  });

  it('returns a selected conversation with messages sorted oldest first', () => {
    const selected = conversation('selected', {
      messages: [
        { id: 'new', created_at: 20 },
        { id: 'old', created_at: 10 },
      ],
    });
    const { result } = renderHook(() => useConversationSelection([selected]));
    act(() => result.current.setSelectedConversationId('selected'));
    expect(result.current.selectedConversation?.messages.map((message: any) => message.id)).toEqual(
      ['old', 'new']
    );
    act(() => result.current.setSelectedConversationId('missing'));
    expect(result.current.selectedConversation).toBeUndefined();
  });
});
