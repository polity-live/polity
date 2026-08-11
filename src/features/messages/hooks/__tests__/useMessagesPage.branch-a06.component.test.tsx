/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => `t:${key}`),
  navigate: vi.fn(),
  useSearch: vi.fn(),
  useAuth: vi.fn(),
  useOnlineUsers: vi.fn(),
  useUserState: vi.fn(),
  useConversationData: vi.fn(),
  useMessageMutations: vi.fn(),
  useConversationFilters: vi.fn(),
  useConversationSelection: vi.fn(),
  useMessageState: vi.fn(),
  useSwipeNavigation: vi.fn(),
  useNewAiConversationIntent: vi.fn(),
  isAssistantConversation: vi.fn((conversation: { assistant?: boolean }) =>
    Boolean(conversation.assistant)
  ),
  isConversationRequester: vi.fn(
    (conversation: { requested_by_id?: string | null }, userId?: string) =>
      conversation.requested_by_id === userId
  ),
  mutations: {
    markConversationAsRead: vi.fn(),
    createConversation: vi.fn(),
    createAssistantConversation: vi.fn(),
    deleteConversation: vi.fn(),
    acceptConversation: vi.fn(),
    rejectConversation: vi.fn(),
    sendMessage: vi.fn(),
    togglePin: vi.fn(),
    updateConversationName: vi.fn(),
  },
  setSearchQuery: vi.fn(),
  setConversationFilter: vi.fn(),
  setSelectedConversationId: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: mocks.useSearch,
}));
vi.mock('@/presence', () => ({ useOnlineUsers: mocks.useOnlineUsers }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: mocks.useAuth }));
vi.mock('@/zero/users/useUserState', () => ({ useUserState: mocks.useUserState }));
vi.mock('@/zero/messages/useMessageState', () => ({ useMessageState: mocks.useMessageState }));
vi.mock('../useConversationData', () => ({ useConversationData: mocks.useConversationData }));
vi.mock('../useMessageMutations', () => ({ useMessageMutations: mocks.useMessageMutations }));
vi.mock('../useConversationFilters', () => ({
  useConversationFilters: mocks.useConversationFilters,
}));
vi.mock('../useConversationSelection', () => ({
  useConversationSelection: mocks.useConversationSelection,
}));
vi.mock('../useNewAiConversationIntent', () => ({
  useNewAiConversationIntent: mocks.useNewAiConversationIntent,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: mocks.t }),
}));
vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantConversation: mocks.isAssistantConversation,
}));
vi.mock('@/features/shared/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: mocks.useSwipeNavigation,
}));
vi.mock('../../logic/messageUtils', () => ({
  isConversationRequester: mocks.isConversationRequester,
}));

import { useMessagesPage } from '../useMessagesPage';

function participant(id?: string) {
  return { user: id === undefined ? undefined : { id } };
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    type: 'direct',
    status: 'accepted',
    participants: [participant('current-user'), participant('other-user')],
    requested_by_id: 'current-user',
    ...overrides,
  };
}

interface SetupOptions {
  user?: { id: string } | null;
  search?: Record<string, string>;
  conversations?: ReturnType<typeof conversation>[];
  filteredConversations?: ReturnType<typeof conversation>[];
  selectedConversationId?: string | null;
  selectedConversation?: ReturnType<typeof conversation> | null;
  messages?: unknown[];
  isLoading?: boolean;
  isSelectedMessagesLoading?: boolean;
  onlineUserIds?: Set<string>;
  currentUser?: { first_name?: string | null; last_name?: string | null } | null;
}

function setup(options: SetupOptions = {}) {
  const conversations = options.conversations ?? [];
  const filteredConversations = options.filteredConversations ?? conversations;
  mocks.useSearch.mockReturnValue(options.search ?? {});
  mocks.useAuth.mockReturnValue({
    user: options.user === undefined ? { id: 'current-user' } : options.user,
  });
  mocks.useOnlineUsers.mockReturnValue({ onlineUserIds: options.onlineUserIds ?? new Set() });
  mocks.useUserState.mockReturnValue({
    currentUser:
      options.currentUser === undefined
        ? { first_name: 'Current', last_name: 'User' }
        : options.currentUser,
  });
  mocks.useConversationData.mockReturnValue({
    conversations,
    isLoading: options.isLoading ?? false,
  });
  mocks.useMessageMutations.mockReturnValue(mocks.mutations);
  mocks.useConversationFilters.mockReturnValue({
    searchQuery: '',
    setSearchQuery: mocks.setSearchQuery,
    conversationFilter: 'all',
    setConversationFilter: mocks.setConversationFilter,
    filteredConversations,
  });
  mocks.useConversationSelection.mockReturnValue({
    selectedConversationId: options.selectedConversationId ?? null,
    setSelectedConversationId: mocks.setSelectedConversationId,
    selectedConversation: options.selectedConversation ?? null,
  });
  mocks.useMessageState.mockReturnValue({
    messages: options.messages ?? [],
    isLoading: options.isSelectedMessagesLoading ?? false,
  });
  mocks.useSwipeNavigation.mockImplementation(options => ({
    handlers: { onKeyDown: options.onSwipeNext },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutations.createConversation.mockResolvedValue({ success: false });
  mocks.mutations.createAssistantConversation.mockResolvedValue({ success: false });
  mocks.mutations.deleteConversation.mockResolvedValue({ success: false });
  mocks.mutations.rejectConversation.mockResolvedValue({ success: false });
  mocks.mutations.sendMessage.mockResolvedValue({ success: false });
  mocks.mutations.updateConversationName.mockResolvedValue({ success: false });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMessagesPage branch contract', () => {
  it('derives names, online states, direct-user ids, swipe bounds, and selected loading state', () => {
    const conversations = [
      conversation({ id: 'group', type: 'group' }),
      conversation({ id: 'event', type: 'event' }),
      conversation({ id: 'pending', status: 'pending' }),
      conversation({
        id: 'online',
        participants: [participant('current-user'), participant('on')],
      }),
      conversation({
        id: 'offline',
        participants: [participant('current-user'), participant('off')],
      }),
      conversation({
        id: 'missing-other',
        participants: [participant('current-user'), participant()],
      }),
      conversation({ id: 'assistant', assistant: true }),
      conversation({
        id: 'self-and-other',
        participants: [participant('current-user'), participant('new-user'), participant()],
      }),
    ];
    setup({
      conversations,
      filteredConversations: conversations,
      selectedConversationId: 'online',
      selectedConversation: conversations[3],
      messages: Array.from({ length: 80 }),
      isSelectedMessagesLoading: true,
      onlineUserIds: new Set(['on']),
    });

    const { result } = renderHook(() => useMessagesPage());
    const swipeOptions = mocks.useSwipeNavigation.mock.calls.at(-1)?.[0];

    expect(result.current.conversationOnlineStatus).toEqual(
      expect.objectContaining({
        group: false,
        event: false,
        pending: false,
        online: true,
        offline: false,
        'missing-other': false,
      })
    );
    expect(result.current.selectedConversationUserOnline).toBe(true);
    expect(result.current.existingConversationUserIds).toContain('new-user');
    expect(result.current.existingConversationUserIds).not.toContain('current-user');
    expect(result.current.isSelectedMessagesLoading).toBe(true);
    expect(result.current.hasMoreOlderMessages).toBe(true);
    expect(swipeOptions.enabled).toBe(true);
    expect(swipeOptions.canSwipePrev).toBe(true);
    expect(swipeOptions.canSwipeNext).toBe(true);

    act(() => {
      swipeOptions.onSwipePrev();
      swipeOptions.onSwipeNext();
    });
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('pending');
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('offline');
    expect(mocks.mutations.markConversationAsRead).toHaveBeenCalledWith(
      conversations[3],
      'current-user'
    );
  });

  it('uses anonymous fallbacks and covers disabled swipe and absent selection outcomes', () => {
    setup({
      user: null,
      currentUser: { first_name: null, last_name: null },
      conversations: [conversation({ participants: [participant('someone')] })],
      filteredConversations: [],
      selectedConversationId: null,
      selectedConversation: null,
    });
    const { result } = renderHook(() => useMessagesPage());
    const swipeOptions = mocks.useSwipeNavigation.mock.calls.at(-1)?.[0];

    expect(result.current.currentUserId).toBeUndefined();
    expect(result.current.selectedConversationUserOnline).toBe(false);
    expect(result.current.isSelectedMessagesLoading).toBe(false);
    expect(result.current.hasMoreOlderMessages).toBe(false);
    expect(swipeOptions.enabled).toBe(false);
    expect(swipeOptions.canSwipePrev).toBe(false);
    expect(swipeOptions.canSwipeNext).toBe(false);
    act(() => swipeOptions.onSwipeNext());
    expect(mocks.setSelectedConversationId).not.toHaveBeenCalled();
    expect(mocks.t).toHaveBeenCalledWith('features.messages.fallbacks.someone');
  });

  it('opens and clears compose URL intents, including search fallbacks and preserved keys', () => {
    setup({
      search: {
        new: '1',
        userSearch: 'Ada',
        search: 'ignored',
        conversationId: 'missing',
        userId: 'target',
        name: 'Name',
        keep: 'yes',
      },
      isLoading: true,
    });
    const { result } = renderHook(() => useMessagesPage());

    expect(result.current.userSearchDialogOpen).toBe(true);
    expect(result.current.newConversationSearch).toBe('Ada');
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/messages',
      search: { keep: 'yes' },
      replace: true,
    });

    act(() => result.current.setUserSearchDialogOpen(true));
    act(() => result.current.setUserSearchDialogOpen(false));
    expect(result.current.newConversationSearch).toBe('');

    cleanup();
    mocks.navigate.mockClear();
    setup({ search: { new: '1', search: 'fallback search' }, isLoading: true });
    const fallback = renderHook(() => useMessagesPage());
    expect(fallback.result.current.newConversationSearch).toBe('fallback search');

    cleanup();
    mocks.navigate.mockClear();
    setup({ search: {} });
    const empty = renderHook(() => useMessagesPage());
    act(() => empty.result.current.setUserSearchDialogOpen(false));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('uses empty fallbacks for a compose search and an unindexed selected conversation', () => {
    const ghost = conversation({ id: 'ghost' });
    setup({
      search: { new: '1' },
      conversations: [],
      selectedConversationId: ghost.id,
      selectedConversation: ghost,
    });

    const { result } = renderHook(() => useMessagesPage());

    expect(result.current.newConversationSearch).toBe('');
    expect(result.current.selectedConversationUserOnline).toBe(false);
  });

  it('selects a requested conversation only after loading and routes missing ids safely', () => {
    const target = conversation({ id: 'target-conversation' });
    setup({ search: { conversationId: target.id }, conversations: [target] });
    renderHook(() => useMessagesPage());

    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith(target.id);
    expect(mocks.setSearchQuery).toHaveBeenCalledWith('');
    expect(mocks.navigate).toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    setup({ search: { conversationId: 'unknown' }, conversations: [target] });
    renderHook(() => useMessagesPage());
    expect(mocks.setSelectedConversationId).not.toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    setup({ search: { conversationId: target.id }, conversations: [target], isLoading: true });
    renderHook(() => useMessagesPage());
    expect(mocks.setSelectedConversationId).not.toHaveBeenCalled();
  });

  it('routes user intents to existing direct chats or to a preselected new-chat dialog', () => {
    const matching = conversation({
      id: 'matching',
      participants: [participant('current-user'), participant('target-user')],
    });
    const irrelevant = [
      conversation({ id: 'group', type: 'group' }),
      conversation({ id: 'assistant', assistant: true }),
      conversation({ id: 'other', participants: [participant('different')] }),
    ];
    setup({ search: { userId: 'target-user' }, conversations: [...irrelevant, matching] });
    const existing = renderHook(() => useMessagesPage());
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('matching');
    expect(existing.result.current.userSearchDialogOpen).toBe(false);

    cleanup();
    vi.clearAllMocks();
    setup({ search: { userId: 'new-user' }, conversations: irrelevant });
    const missing = renderHook(() => useMessagesPage());
    expect(missing.result.current.userSearchDialogOpen).toBe(true);
    expect(missing.result.current.newConversationTargetUserId).toBe('new-user');

    cleanup();
    vi.clearAllMocks();
    setup({ search: {}, conversations: irrelevant });
    renderHook(() => useMessagesPage());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('creates or reuses direct conversations and validates every participant condition', async () => {
    const existing = conversation({ id: 'existing' });
    setup({ conversations: [existing] });
    const reused = renderHook(() => useMessagesPage());
    await act(() => reused.result.current.handleCreateConversationRequest('other-user'));
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('existing');
    expect(mocks.mutations.createConversation).not.toHaveBeenCalled();

    cleanup();
    vi.clearAllMocks();
    const nonMatches = [
      conversation({ type: 'group' }),
      conversation({ assistant: true }),
      conversation({ participants: [participant('current-user')] }),
      conversation({ participants: [participant('current-user'), participant('not-target')] }),
      conversation({ participants: [participant('target'), participant('not-current')] }),
    ];
    mocks.mutations.createConversation.mockResolvedValue({
      success: true,
      conversationId: 'created',
    });
    setup({ conversations: nonMatches });
    const created = renderHook(() => useMessagesPage());
    await act(() => created.result.current.handleCreateConversationRequest('other-user'));
    expect(mocks.mutations.createConversation).toHaveBeenCalledWith(
      'direct',
      ['current-user', 'other-user'],
      undefined,
      'current-user'
    );
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('created');

    cleanup();
    vi.clearAllMocks();
    mocks.mutations.createConversation.mockResolvedValue({ success: true, conversationId: null });
    setup({ conversations: [] });
    const incomplete = renderHook(() => useMessagesPage());
    await act(() => incomplete.result.current.handleCreateConversationRequest('other-user'));

    cleanup();
    setup({ user: null });
    const anonymous = renderHook(() => useMessagesPage());
    await act(() => anonymous.result.current.handleCreateConversationRequest('other-user'));
  });

  it('creates assistant chats, consumes the AI intent, and covers success-field combinations', async () => {
    mocks.mutations.createAssistantConversation.mockResolvedValue({
      success: true,
      conversationId: 'assistant-1',
    });
    setup({ search: { new: 'ai' } });
    renderHook(() => useMessagesPage());
    const intent = mocks.useNewAiConversationIntent.mock.calls.at(-1)?.[0];
    expect(intent.enabled).toBe(true);
    expect(intent.ready).toBe(true);
    await act(() => intent.onCreate());
    act(() => intent.onConsume());
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith('assistant-1');
    expect(mocks.setConversationFilter).toHaveBeenCalledWith('ai');

    cleanup();
    vi.clearAllMocks();
    mocks.mutations.createAssistantConversation.mockResolvedValue({
      success: true,
      conversationId: null,
    });
    setup({ search: {}, isLoading: true });
    const loading = renderHook(() => useMessagesPage());
    expect(mocks.useNewAiConversationIntent.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ enabled: false, ready: false })
    );
    await act(() => loading.result.current.handleCreateAssistantConversation());

    cleanup();
    setup({ user: null });
    const anonymous = renderHook(() => useMessagesPage());
    await act(() => anonymous.result.current.handleCreateAssistantConversation());
  });

  it('deletes, accepts, rejects, sends, renames, and opens dialogs across result variants', async () => {
    const selected = conversation({ id: 'selected', requested_by_id: null });
    const other = conversation({ id: 'other' });
    setup({
      conversations: [selected, other],
      selectedConversationId: 'selected',
      selectedConversation: selected,
    });
    const { result } = renderHook(() => useMessagesPage());

    await act(() => result.current.handleDeleteConversation());
    act(() => result.current.openDeleteDialog('missing'));
    await act(() => result.current.handleDeleteConversation());

    mocks.mutations.deleteConversation.mockResolvedValue({ success: true });
    act(() => result.current.openDeleteDialog('selected'));
    await act(() => result.current.handleDeleteConversation());
    expect(mocks.setSelectedConversationId).toHaveBeenCalledWith(null);

    await act(() => result.current.handleAcceptConversation(selected as never));
    expect(mocks.mutations.acceptConversation).toHaveBeenCalledWith(
      'selected',
      expect.objectContaining({ requesterUserId: undefined, senderName: 'Current User' })
    );

    mocks.mutations.rejectConversation.mockResolvedValue({ success: true });
    await act(() => result.current.handleRejectConversation(selected as never));
    mocks.mutations.rejectConversation.mockResolvedValue({ success: false });
    await act(() => result.current.handleRejectConversation(other as never));

    mocks.mutations.sendMessage.mockResolvedValue({ success: true });
    await expect(result.current.handleSendMessage('hello', '{}')).resolves.toBe(true);
    mocks.mutations.sendMessage.mockResolvedValue({ success: false });
    await expect(result.current.handleSendMessage('again', '{}')).resolves.toBe(false);
    expect(mocks.mutations.sendMessage).toHaveBeenCalledWith(
      'selected',
      'current-user',
      'hello',
      undefined,
      { contextJson: '{}' }
    );

    mocks.mutations.updateConversationName.mockResolvedValue({ success: true });
    await expect(result.current.handleRenameConversation('selected', 'Renamed')).resolves.toBe(
      true
    );
    mocks.mutations.updateConversationName.mockResolvedValue({ success: false });
    await expect(result.current.handleRenameConversation('selected', null)).resolves.toBe(false);

    act(() => result.current.openNewConversationDialog());
    expect(result.current.userSearchDialogOpen).toBe(true);
  });

  it('covers anonymous mutation guards, non-selected successful results, and cancel-request checks', async () => {
    const pending = conversation({ id: 'pending', status: 'pending' });
    mocks.isConversationRequester.mockReturnValueOnce(true);
    setup({ user: null, conversations: [pending], selectedConversationId: null });
    const { result } = renderHook(() => useMessagesPage());

    act(() => result.current.openDeleteDialog('pending'));
    expect(result.current.isCancelRequest).toBe(true);
    await act(() => result.current.handleAcceptConversation(pending as never));
    await expect(result.current.handleSendMessage('no', '{}')).resolves.toBe(false);

    cleanup();
    vi.clearAllMocks();
    mocks.mutations.deleteConversation.mockResolvedValue({ success: true });
    mocks.mutations.rejectConversation.mockResolvedValue({ success: true });
    setup({ conversations: [pending], selectedConversationId: 'different' });
    const nonSelected = renderHook(() => useMessagesPage());
    act(() => nonSelected.result.current.openDeleteDialog('pending'));
    await act(() => nonSelected.result.current.handleDeleteConversation());
    await act(() => nonSelected.result.current.handleRejectConversation(pending as never));
    expect(mocks.setSelectedConversationId).not.toHaveBeenCalledWith(null);
  });

  it('gates read receipts by thread end and document visibility and caps older-message pages', () => {
    const selected = conversation({ id: 'selected' });
    setup({
      conversations: [selected],
      selectedConversationId: 'selected',
      selectedConversation: selected,
    });
    const { result } = renderHook(() => useMessagesPage());
    mocks.mutations.markConversationAsRead.mockClear();

    act(() => result.current.setIsSelectedConversationAtEnd(false));
    expect(mocks.mutations.markConversationAsRead).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => result.current.setIsSelectedConversationAtEnd(true));
    expect(mocks.mutations.markConversationAsRead).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => result.current.setIsSelectedConversationAtEnd(false));
    act(() => result.current.setIsSelectedConversationAtEnd(true));
    expect(mocks.mutations.markConversationAsRead).toHaveBeenCalled();

    act(() => {
      for (let page = 0; page < 63; page += 1) result.current.loadOlderMessages();
    });
    expect(mocks.useMessageState.mock.calls.at(-1)?.[0].messageLimit).toBe(5000);
  });
});
