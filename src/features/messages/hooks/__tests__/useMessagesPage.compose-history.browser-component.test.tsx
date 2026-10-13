import { act, cleanup, renderHook } from '@testing-library/react';
import { createBrowserHistory } from '@tanstack/react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMessagesPage } from '../useMessagesPage';
import { useConversationSelection } from '../useConversationSelection';
import type { Conversation } from '../../types/message.types';

const fixture = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  loading: false,
  rows: [
    {
      id: 'selected',
      type: 'direct',
      status: 'accepted',
      messages: [],
      participants: [{ user_id: 'owner', user: { id: 'owner' } }],
    },
  ],
  messages: [],
  online: new Set<string>(),
  navigate: vi.fn(),
  mutations: { markConversationAsRead: vi.fn() },
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<object>()),
  useNavigate: () => fixture.navigate,
  useSearch: () => fixture.params,
}));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/presence', () => ({ useOnlineUsers: () => ({ onlineUserIds: fixture.online }) }));
vi.mock('@/zero/users/useUserState', () => ({
  useUserState: () => ({ currentUser: { first_name: 'Owner' } }),
}));
vi.mock('@/zero/messages/useMessageState', () => ({
  useMessageState: () => ({ messages: fixture.messages, isLoading: false }),
}));
vi.mock('../useConversationData', () => ({
  useConversationData: () => ({
    conversations: fixture.rows,
    isLoading: fixture.loading,
    allConversationsLoaded: true,
  }),
}));
vi.mock('../useMessageMutations', () => ({ useMessageMutations: () => fixture.mutations }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {} }),
}));

beforeEach(() => {
  fixture.loading = false;
  fixture.navigate.mockReset();
});
afterEach(cleanup);

interface ConsumeOptions {
  to: string;
  search: Record<string, string>;
  state: (previous: Record<string, unknown>) => Record<string, unknown>;
}

function nativeHistory(params: Record<string, string>) {
  const original = { state: window.history.state, url: window.location.href };
  const history = createBrowserHistory();
  fixture.params = params;
  window.history.replaceState(
    {
      __TSR_key: window.history.state.__TSR_key,
      __TSR_index: window.history.state.__TSR_index,
      customState: { retained: true },
    },
    '',
    `/messages?${new URLSearchParams(params).toString()}`
  );
  const index = window.history.state.__TSR_index;
  const notifications: string[] = [];
  const unsubscribe = history.subscribe(({ action }) => notifications.push(action.type));
  fixture.navigate.mockImplementation((options: ConsumeOptions) => {
    const search = new URLSearchParams(options.search).toString();
    history.replace(options.to + (search ? `?${search}` : ''), options.state(window.history.state));
  });
  return {
    history,
    index,
    notifications,
    close: () => {
      unsubscribe();
      history.destroy();
      window.history.replaceState(original.state, '', original.url);
    },
  };
}

it('persists a ready authorized URL selection with one replacement and restores it on remount', async () => {
  const context = nativeHistory({ conversationId: 'selected', openAriaKai: 'false' });
  const hook = renderHook(() => useMessagesPage());
  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.selectedConversationId).toBe('selected');
    expect(context.notifications).toEqual(['REPLACE']);
    expect(fixture.navigate).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe('/messages');
    expect(window.location.search).toBe('?openAriaKai=false');
    expect(window.history.state).toMatchObject({
      __TSR_index: context.index,
      customState: { retained: true },
      polityMessageSelection: { viewerID: 'owner', conversationID: 'selected' },
    });
    fixture.params = { openAriaKai: 'false' };
    hook.unmount();
    const restored = renderHook(() => useMessagesPage());
    expect(restored.result.current.selectedConversationId).toBe('selected');
    expect(context.notifications).toEqual(['REPLACE']);
    restored.unmount();
  } finally {
    hook.unmount();
    context.close();
  }
});

it.each<{ params: Record<string, string>; loading: boolean; selected: string | null }>([
  { params: { conversationId: 'selected' }, loading: true, selected: 'selected' },
  { params: { conversationId: 'private-or-missing' }, loading: false, selected: null },
  { params: {}, loading: false, selected: null },
])('keeps ordinary persistence when the URL target cannot be consumed: %j', async scenario => {
  const context = nativeHistory(scenario.params);
  fixture.loading = scenario.loading;
  const hook = renderHook(() => useMessagesPage());
  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.selectedConversationId).toBe(scenario.selected);
    expect(fixture.navigate).not.toHaveBeenCalled();
    expect(context.notifications).toEqual(['REPLACE']);
    expect(window.history.state).toMatchObject({
      customState: { retained: true },
      polityMessageSelection: { viewerID: 'owner', conversationID: scenario.selected },
    });
  } finally {
    hook.unmount();
    context.close();
  }
});

it('retains the authorized URL target when a public history blocker cancels its consumption', async () => {
  const context = nativeHistory({ conversationId: 'selected' });
  const unblock = context.history.block({ blockerFn: () => true, enableBeforeUnload: false });
  const hook = renderHook(() => useMessagesPage());
  try {
    await act(async () => {
      await Promise.resolve();
    });
    expect(context.notifications).toEqual([]);
    expect(window.location.search).toBe('?conversationId=selected');
    expect(hook.result.current.selectedConversationId).toBe('selected');
    hook.unmount();
    const restored = renderHook(() => useMessagesPage());
    expect(restored.result.current.selectedConversationId).toBe('selected');
    restored.unmount();

    const rows = [
      ...fixture.rows,
      { ...fixture.rows[0], id: 'other' },
    ] as unknown as Conversation[];
    const selection = renderHook(() =>
      useConversationSelection(rows, {
        viewerID: 'owner',
        restoreOnNavigation: true,
        persistSelection: false,
        initialConversationID: 'selected',
      })
    );
    act(() => selection.result.current.setSelectedConversationId('other'));
    expect(window.history.state).toMatchObject({
      polityMessageSelection: { viewerID: 'owner', conversationID: 'other' },
    });
    expect(window.location.search).toBe('?conversationId=selected');
    selection.unmount();
  } finally {
    hook.unmount();
    unblock();
    context.close();
  }
});
