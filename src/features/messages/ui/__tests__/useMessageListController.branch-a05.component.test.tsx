// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMessageListController } from '../useMessageListController';

const mocks = vi.hoisted(() => ({
  virtual: {
    items: [] as any[],
    spaceBefore: 1,
    spaceAfter: 2,
    rowsEmpty: false,
  },
  listOptions: null as any,
  otherUser: null as any,
  messagePage: vi.fn(),
  messageById: vi.fn(),
  stick: vi.fn(),
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroList: (options: any) => {
    mocks.listOptions = options;
    return mocks.virtual;
  },
}));

vi.mock('@rocicorp/zero-virtual/react', () => ({
  useStickToBottom: (...args: any[]) => mocks.stick(...args),
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    messages: {
      messagePage: (...args: any[]) => mocks.messagePage(...args),
      messageById: (...args: any[]) => mocks.messageById(...args),
    },
  },
}));

vi.mock('../../logic/messageUtils', () => ({
  getOtherParticipant: () => mocks.otherUser,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function message(id: string, senderId = 'other') {
  return { id, created_at: '7', sender: { id: senderId } } as any;
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    type: 'group',
    status: 'active',
    messages: [message('one')],
    ...overrides,
  } as any;
}

function controllerProps(overrides: Record<string, unknown> = {}) {
  return {
    conversation: conversation(),
    currentUserId: 'current',
    onAcceptConversation: vi.fn(),
    onRejectConversation: vi.fn(),
    ...overrides,
  } as any;
}

describe('useMessageListController branch coverage', () => {
  beforeEach(() => {
    mocks.virtual = { items: [], spaceBefore: 1, spaceAfter: 2, rowsEmpty: false };
    mocks.listOptions = null;
    mocks.otherUser = null;
    mocks.messagePage.mockReset().mockReturnValue('page-query');
    mocks.messageById.mockReset().mockReturnValue('single-query');
    mocks.stick.mockReset();
  });

  afterEach(cleanup);

  it('configures virtualization, anchors conversations, and maps all row kinds', () => {
    mocks.virtual = {
      items: [
        { index: 0, key: 'row-1', row: message('row-1') },
        { index: 1, key: 'row-2', row: undefined },
      ],
      spaceBefore: 10,
      spaceAfter: 20,
      rowsEmpty: false,
    };
    mocks.otherUser = { first_name: 'Ada', last_name: 'Lovelace' };
    const props = controllerProps({
      conversation: conversation({ type: 'direct', status: 'pending' }),
      streamingAssistantMessage: { text: 'stream' },
    });
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: props,
    });

    expect(mocks.listOptions.scrollStateKey).toBe('messages-thread-conversation-1');
    expect(mocks.listOptions.permalinkID).toBe('one');
    expect(mocks.listOptions.getScrollElement()).toBeNull();
    expect(mocks.listOptions.estimateSize()).toBe(92);
    expect(mocks.listOptions.getRowKey(message('key'))).toBe('key');
    expect(mocks.listOptions.toStartRow(message('start'))).toEqual({ created_at: 7, id: 'start' });
    expect(
      mocks.listOptions.getPageQuery({ limit: 5, start: null, dir: 'older', settled: true })
    ).toEqual({
      query: 'page-query',
      options: { ttl: '5m' },
    });
    expect(
      mocks.listOptions.getPageQuery({ limit: 5, start: null, dir: 'older', settled: false })
    ).toEqual({
      query: 'page-query',
      options: { ttl: 'none' },
    });
    expect(mocks.listOptions.getSingleQuery({ id: 'one', settled: true })).toEqual({
      query: 'single-query',
      options: { ttl: '5m' },
    });
    expect(mocks.listOptions.getSingleQuery({ id: 'one', settled: false })).toEqual({
      query: 'single-query',
      options: { ttl: 'none' },
    });
    expect(result.current.otherParticipantName).toBe('Ada Lovelace');
    expect(result.current.virtualRows.map(row => row.type)).toEqual([
      'message',
      'message',
      'streaming',
      'conversation-request',
    ]);
    expect(result.current.spaceBefore).toBe(10);
    expect(mocks.stick).toHaveBeenCalledWith(mocks.virtual, { enabled: true });

    rerender(props);
    expect(mocks.listOptions.permalinkID).toBe('one');
  });

  it('uses explicit messages, null anchors, and participant-name fallbacks', () => {
    mocks.otherUser = { first_name: '', last_name: null };
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: controllerProps({ messages: [], conversation: conversation({ messages: [] }) }),
    });
    expect(mocks.listOptions.permalinkID).toBeUndefined();
    expect(result.current.otherParticipantName).toBe('common.labels.unspecifiedUser');
    expect(result.current.virtualRows).toEqual([]);

    mocks.otherUser = { first_name: null, last_name: 'Solo' };
    rerender(
      controllerProps({
        messages: [message('two')],
        conversation: conversation({ id: 'conversation-2', type: 'direct', status: 'active' }),
      })
    );
    expect(mocks.listOptions.permalinkID).toBe('two');
    expect(result.current.otherParticipantName).toBe('Solo');
    expect(result.current.virtualRows.every(row => row.type === 'message')).toBe(true);
  });

  it('detaches a minimized conversation viewport and resumes the same message rows when reopened', () => {
    mocks.virtual.items = [{ index: 0, key: 'one', row: message('one') }];
    const initial = controllerProps({ active: true });
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: initial,
    });
    const element = document.createElement('div');
    result.current.scrollRef.current = element;
    expect(mocks.listOptions.getScrollElement()).toBe(element);
    const rows = result.current.virtualRows;
    rerender({ ...initial, active: false });
    expect(mocks.listOptions.getScrollElement()).toBeNull();
    expect(mocks.stick).toHaveBeenLastCalledWith(mocks.virtual, { enabled: false });
    expect(result.current.scrollRef.current).toBe(element);
    expect(result.current.virtualRows).toStrictEqual(rows);
    rerender({ ...initial, active: true });
    expect(mocks.listOptions.getScrollElement()).toBe(element);
    expect(mocks.stick).toHaveBeenLastCalledWith(mocks.virtual, { enabled: true });
  });

  it('keeps a complete short thread in one page while retaining anchors for incomplete and long threads', () => {
    const rows = [message('one'), message('two')];
    const { rerender } = renderHook(values => useMessageListController(values), {
      initialProps: controllerProps({ messages: rows, hasMoreOlderMessages: false }),
    });
    expect(mocks.listOptions.minPageSize).toBe(50);
    expect(mocks.listOptions.permalinkID).toBeUndefined();
    expect(mocks.stick).toHaveBeenLastCalledWith(mocks.virtual, { enabled: true });

    // Receiving another message must not turn the mounted page into a cursor jump.
    rerender(
      controllerProps({ messages: [...rows, message('three')], hasMoreOlderMessages: false })
    );
    expect(mocks.listOptions.permalinkID).toBeUndefined();

    rerender(
      controllerProps({
        conversation: conversation({ id: 'incomplete' }),
        messages: rows,
        hasMoreOlderMessages: true,
      })
    );
    expect(mocks.listOptions.permalinkID).toBe('two');

    const fullPage = Array.from({ length: 50 }, (_, index) => message(`row-${index}`));
    rerender(
      controllerProps({
        conversation: conversation({ id: 'long' }),
        messages: fullPage,
        hasMoreOlderMessages: false,
      })
    );
    expect(mocks.listOptions.permalinkID).toBe('row-49');
  });

  it('uses the project assistant identity and places review events around the correct messages', () => {
    const first = { ...message('first'), created_at: 100 };
    const last = { ...message('last'), created_at: 200 };
    mocks.virtual.items = [
      { index: 0, key: 'first', row: first },
      { index: 1, key: 'placeholder', row: undefined },
      { index: 2, key: 'last', row: last },
    ];
    const early = { id: 'early', createdAt: 50, content: 'Earlier change' };
    const middle = { id: 'middle', createdAt: 150, content: 'Middle change' };
    const late = { id: 'late', createdAt: 250, content: 'Later change' };
    const { result } = renderHook(() =>
      useMessageListController(
        controllerProps({
          conversation: conversation({ type: 'project_ai' }),
          timelineItems: [late, middle, early],
        })
      )
    );
    expect(result.current.otherUser).toEqual({
      id: 'a12a0000-0000-4000-a000-000000000001',
      first_name: 'Aria & Kai',
      last_name: null,
      avatar: '/avatars/aria-kai-avatar-256.webp',
      handle: 'aria-kai',
    });
    expect(result.current.otherParticipantName).toBe('Aria & Kai');
    expect(result.current.virtualRows[0]).toEqual({
      type: 'message',
      index: 0,
      key: 'first',
      message: first,
      timelineBefore: [early],
      timelineAfter: [middle],
    });
    expect(result.current.virtualRows[1]).toEqual({
      type: 'message',
      index: 1,
      key: 'placeholder',
      message: undefined,
    });
    expect(result.current.virtualRows[2]).toEqual({
      type: 'message',
      index: 2,
      key: 'last',
      message: last,
      timelineAfter: [late],
    });
  });

  it('orders consecutive review events and defers them while no message row is loaded', () => {
    mocks.virtual.rowsEmpty = true;
    const before = { id: 'before', createdAt: 1, content: 'Before' };
    const after = { id: 'after', createdAt: 2, content: 'After' };
    const props = controllerProps({ timelineItems: [after, before] });
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: props,
    });
    expect(result.current.virtualRows).toEqual([]);
    expect(result.current.rowsEmpty).toBe(false);
    const row = { ...message('loaded'), created_at: 0 };
    mocks.virtual.items = [{ index: 0, key: 'loaded', row }];
    rerender(props);
    expect(result.current.virtualRows[0]).toEqual({
      type: 'message',
      index: 0,
      key: 'loaded',
      message: row,
      timelineAfter: [before, after],
    });
    row.created_at = 3;
    rerender({ ...props, timelineItems: [before, after] });
    expect(result.current.virtualRows[0]).toEqual({
      type: 'message',
      index: 0,
      key: 'loaded',
      message: row,
      timelineBefore: [before, after],
    });
    mocks.virtual.items = [];
    rerender({ ...props, timelineItems: [] });
    expect(result.current.rowsEmpty).toBe(true);
  });

  it('handles missing and present scroll elements plus near-bottom thresholds', () => {
    const onAtEndChange = vi.fn();
    const { result } = renderHook(() =>
      useMessageListController(controllerProps({ onAtEndChange }))
    );
    act(() => result.current.scrollToBottom());
    act(() => result.current.handleScroll());
    expect(onAtEndChange).not.toHaveBeenCalled();

    const scrollTo = vi.fn();
    const element = {
      scrollHeight: 500,
      scrollTop: 310,
      clientHeight: 100,
      scrollTo,
    } as any;
    act(() => {
      result.current.scrollRef.current = element;
      result.current.handleScroll();
    });
    expect(onAtEndChange).toHaveBeenLastCalledWith(true);

    element.scrollTop = 0;
    act(() => result.current.handleScroll());
    expect(onAtEndChange).toHaveBeenLastCalledWith(false);

    act(() => result.current.scrollToBottom());
    expect(scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
    expect(onAtEndChange).toHaveBeenLastCalledWith(true);
  });

  it('scrolls new own or end-position messages and flags unseen remote messages', async () => {
    const onAtEndChange = vi.fn();
    const initial = controllerProps({
      messages: [message('first')],
      onAtEndChange,
    });
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: initial,
    });
    const scrollTo = vi.fn();
    act(() => {
      result.current.scrollRef.current = {
        scrollHeight: 300,
        scrollTop: 200,
        clientHeight: 100,
        scrollTo,
      } as any;
    });

    rerender({ ...initial, messages: [message('first'), message('second')] });
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());

    act(() => result.current.handleScroll());
    const farElement = result.current.scrollRef.current as any;
    farElement.scrollTop = 0;
    act(() => result.current.handleScroll());
    rerender({
      ...initial,
      messages: [message('first'), message('second'), message('third', 'current')],
    });
    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2));

    farElement.scrollTop = 0;
    act(() => result.current.handleScroll());
    rerender({
      ...initial,
      messages: [
        message('first'),
        message('second'),
        message('third', 'current'),
        message('fourth', 'remote'),
      ],
    });
    await waitFor(() => expect(result.current.hasNewMessages).toBe(true));
    act(() => result.current.scrollToBottom());
    expect(result.current.hasNewMessages).toBe(false);
  });

  it('ignores empty and unchanged message effects and supports an absent end callback', () => {
    const initial = controllerProps({ messages: [] });
    const { result, rerender } = renderHook(values => useMessageListController(values), {
      initialProps: initial,
    });
    rerender({ ...initial, messages: [] });
    rerender({ ...initial, messages: [message('same')] });
    rerender({ ...initial, messages: [message('same')] });

    act(() => {
      result.current.scrollRef.current = {
        scrollHeight: 100,
        scrollTop: 0,
        clientHeight: 100,
        scrollTo: vi.fn(),
      } as any;
      result.current.handleScroll();
    });
    expect(result.current.hasNewMessages).toBe(false);
  });
});
