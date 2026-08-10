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
    expect(mocks.stick).toHaveBeenCalledWith(mocks.virtual);

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
