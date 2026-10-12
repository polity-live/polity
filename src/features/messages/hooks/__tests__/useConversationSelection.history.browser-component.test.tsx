import { act, cleanup, renderHook } from '@testing-library/react';
import { createBrowserHistory } from '@tanstack/react-router';
import { afterEach, expect, it } from 'vitest';
import { useConversationSelection } from '../useConversationSelection';
import type { Conversation } from '../../types/message.types';

afterEach(cleanup);

it('restores a thread without a redundant router navigation and persists real selection changes', () => {
  const original = { state: window.history.state, url: window.location.href };
  const history = createBrowserHistory();
  const options = { viewerID: 'owner', restoreOnNavigation: true };
  const saved = {
    ...window.history.state,
    customState: { retained: true },
    polityMessageSelection: { viewerID: 'owner', conversationID: 'selected' },
  };
  window.history.replaceState(saved, '', window.location.href);
  const notifications: string[] = [];
  const unsubscribe = history.subscribe(({ action }) => notifications.push(action.type));
  const rows = [
    { id: 'selected', type: 'direct', messages: [] },
    { id: 'changed', type: 'direct', messages: [] },
  ] as unknown as Conversation[];
  const hook = renderHook(() => useConversationSelection(rows, options));
  try {
    expect(hook.result.current.selectedConversationId).toBe('selected');
    expect(notifications).toEqual([]);
    expect(window.history.state).toEqual(saved);
    expect(window.location.href).toBe(original.url);

    act(() => hook.result.current.setSelectedConversationId('changed'));
    expect(notifications).toEqual(['REPLACE']);
    expect(window.history.state).toEqual({
      ...saved,
      polityMessageSelection: { viewerID: 'owner', conversationID: 'changed' },
    });
    expect(window.location.href).toBe(original.url);

    hook.unmount();
    const restored = renderHook(() => useConversationSelection(rows, options));
    expect(restored.result.current.selectedConversationId).toBe('changed');
    expect(notifications).toEqual(['REPLACE']);
    expect(window.location.href).toBe(original.url);
    restored.unmount();
  } finally {
    hook.unmount();
    unsubscribe();
    history.destroy();
    window.history.replaceState(original.state, '', original.url);
  }
});

it.each([
  { scenario: 'no saved selection', selection: undefined },
  {
    scenario: 'another viewer’s selection',
    selection: { viewerID: 'another-viewer', conversationID: 'selected' },
  },
])('persists an empty selection on first mount with $scenario', ({ selection }) => {
  const original = { state: window.history.state, url: window.location.href };
  const history = createBrowserHistory();
  const saved = {
    ...window.history.state,
    customState: { retained: true },
    polityMessageSelection: selection,
  };
  window.history.replaceState(saved, '', window.location.href);
  const notifications: string[] = [];
  const unsubscribe = history.subscribe(({ action }) => notifications.push(action.type));
  const hook = renderHook(() =>
    useConversationSelection([], { viewerID: 'owner', restoreOnNavigation: true })
  );
  try {
    expect(hook.result.current.selectedConversationId).toBeNull();
    expect(notifications).toEqual(['REPLACE']);
    expect(window.history.state).toEqual({
      ...saved,
      polityMessageSelection: { viewerID: 'owner', conversationID: null },
    });
    expect(window.location.href).toBe(original.url);
  } finally {
    hook.unmount();
    unsubscribe();
    history.destroy();
    window.history.replaceState(original.state, '', original.url);
  }
});
