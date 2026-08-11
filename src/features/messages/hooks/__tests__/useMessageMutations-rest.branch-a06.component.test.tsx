/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../../types/message.types';

const mocks = vi.hoisted(() => ({
  actions: {
    sendMessage: vi.fn(),
    sendAssistantMessage: vi.fn(),
    createConversationFull: vi.fn(),
    deleteMessage: vi.fn(),
    updateMessage: vi.fn(),
    markRead: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversationFull: vi.fn(),
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  finalization: vi.fn(),
  wait: vi.fn(),
}));

vi.mock('@/zero/messages/useMessageActions', () => ({ useMessageActions: () => mocks.actions }));
vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({ translate: (key: string) => key }));
vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (value: unknown) => mocks.wait(value),
}));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackMutationFinalization: (options: unknown) => mocks.finalization(options),
}));

import { useMessageMutations } from '../useMessageMutations';

const conversation = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'conversation',
    type: 'direct',
    status: 'accepted',
    requested_by_id: 'other',
    created_at: 10,
    messages: [],
    participants: [],
    ...overrides,
  }) as unknown as Conversation;

describe('useMessageMutations branch remainder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const action of Object.values(mocks.actions)) action.mockReturnValue(Promise.resolve());
    mocks.wait.mockImplementation((value: unknown) => Promise.resolve(value));
    let id = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(
      () =>
        `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}` as `${string}-${string}-${string}-${string}-${string}`
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('sends regular and assistant messages with default and explicit contexts', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      expect(await result.current.sendMessage('c', 'sender', 'one', ['recipient'])).toMatchObject({
        success: true,
      });
      await result.current.sendMessage('c', 'sender', 'two', undefined, { contextJson: '[1]' });
      await result.current.sendAssistantMessage('c', 'assistant');
      await result.current.sendAssistantMessage('c', 'assistant-context', { contextJson: '[2]' });
    });

    expect(mocks.actions.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ content: 'one', context_json: '[]' })
    );
    expect(mocks.actions.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ content: 'two', context_json: '[1]' })
    );
    expect(mocks.actions.sendAssistantMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ context_json: '[]' })
    );
    expect(mocks.actions.sendAssistantMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ context_json: '[2]' })
    );
  });

  it('returns deterministic send failures and restores loading', async () => {
    mocks.actions.sendMessage.mockImplementationOnce(() => {
      throw new Error('regular failed');
    });
    mocks.actions.sendAssistantMessage.mockReturnValueOnce(Promise.reject(new Error('AI failed')));
    const { result } = renderHook(() => useMessageMutations());

    await act(async () => {
      expect(await result.current.sendMessage('c', 's', 'content')).toMatchObject({
        success: false,
      });
      expect(await result.current.sendAssistantMessage('c', 'content')).toMatchObject({
        success: false,
      });
    });
    expect(result.current.isLoading).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('creates regular conversations with optional group and handles failure', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(123);
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      expect(
        await result.current.createConversation('direct', ['one'], undefined, 'creator')
      ).toMatchObject({
        success: true,
      });
      await result.current.createConversation('group', ['two', 'three'], 'group');
    });
    expect(mocks.actions.createConversationFull).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ conversation: expect.objectContaining({ group_id: null }) })
    );
    expect(mocks.actions.createConversationFull).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversation: expect.objectContaining({ group_id: 'group' }),
        participants: expect.arrayContaining([expect.objectContaining({ joined_at: 123 })]),
      })
    );

    mocks.actions.createConversationFull.mockImplementationOnce(() => {
      throw new Error('create failed');
    });
    await act(async () => {
      expect(await result.current.createConversation('direct', [])).toMatchObject({
        success: false,
      });
    });
    now.mockRestore();
  });

  it('creates assistant conversations with default/custom names and handles failure', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      await result.current.createAssistantConversation('current');
      await result.current.createAssistantConversation('current', 'Custom');
    });
    expect(mocks.actions.createConversationFull).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversation: expect.objectContaining({ name: 'Assistent Aria & Kai' }),
      })
    );
    expect(mocks.actions.createConversationFull).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ conversation: expect.objectContaining({ name: 'Custom' }) })
    );

    mocks.actions.createConversationFull.mockReturnValueOnce(Promise.reject(new Error('failed')));
    await act(async () => {
      expect(await result.current.createAssistantConversation('current')).toMatchObject({
        success: false,
      });
    });
  });

  it('deletes messages and accepts conversations on success and error', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      expect(await result.current.deleteMessage('message')).toEqual({ success: true });
      expect(
        await result.current.acceptConversation('conversation', { senderId: 'sender' })
      ).toEqual({
        success: true,
      });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);

    mocks.actions.deleteMessage.mockReturnValueOnce(Promise.reject(new Error('delete')));
    mocks.actions.updateConversation.mockReturnValueOnce(Promise.reject(new Error('accept')));
    await act(async () => {
      expect(await result.current.deleteMessage('message')).toMatchObject({ success: false });
      expect(await result.current.acceptConversation('conversation')).toMatchObject({
        success: false,
      });
    });
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('marks unread messages and both participant identity shapes as read', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      await result.current.markConversationAsRead(conversation(), 'current');
      await result.current.markConversationAsRead(
        conversation({
          messages: [
            { id: 'own', is_read: false, sender: { id: 'current' } },
            { id: 'read', is_read: true, sender: { id: 'other' } },
            { id: 'unread', is_read: false, sender: null },
          ],
          participants: [{ id: 'participant', user_id: 'current' }],
        }),
        'current'
      );
      await result.current.markConversationAsRead(
        conversation({
          status: 'pending',
          requested_by_id: 'other',
          created_at: 20,
          participants: [{ id: 'nested', user: { id: 'current' }, last_read_at: 0 }],
        }),
        'current'
      );
    });
    expect(mocks.actions.updateMessage).toHaveBeenCalledOnce();
    expect(mocks.actions.markRead).toHaveBeenCalledTimes(2);
  });

  it('continues safely without a participant and catches mark-read failures', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      await result.current.markConversationAsRead(
        conversation({ messages: [{ id: 'unread', is_read: false, sender: { id: 'other' } }] }),
        'current'
      );
    });
    expect(mocks.actions.markRead).not.toHaveBeenCalled();

    mocks.actions.updateMessage.mockReturnValueOnce(Promise.reject(new Error('update')));
    await act(async () => {
      await result.current.markConversationAsRead(
        conversation({ messages: [{ id: 'unread', is_read: false, sender: { id: 'other' } }] }),
        'current'
      );
    });
    expect(console.error).toHaveBeenCalledWith(
      'Failed to mark messages as read:',
      expect.any(Error)
    );
  });

  it('toggles pin/name values and covers their errors', async () => {
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      await result.current.togglePin('conversation', false);
      await result.current.togglePin('conversation', true);
      await result.current.updateConversationName('conversation', 'Name');
      await result.current.updateConversationName('conversation', null);
    });
    expect(mocks.actions.updateConversation).toHaveBeenCalledWith({
      id: 'conversation',
      pinned: true,
    });
    expect(mocks.actions.updateConversation).toHaveBeenCalledWith({
      id: 'conversation',
      pinned: false,
    });

    mocks.actions.updateConversation.mockReturnValueOnce(Promise.reject(new Error('pin')));
    mocks.actions.updateConversation.mockReturnValueOnce(Promise.reject(new Error('name')));
    await act(async () => {
      expect(await result.current.togglePin('conversation', false)).toMatchObject({
        success: false,
      });
      expect(await result.current.updateConversationName('conversation', null)).toMatchObject({
        success: false,
      });
    });
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
  });

  it('tracks reject/delete success and distinguishes pre/post-finalization errors', async () => {
    const target = conversation({
      messages: [{ id: 'one' }],
      participants: [{ id: 'participant' }],
    });
    const { result } = renderHook(() => useMessageMutations());
    await act(async () => {
      expect(await result.current.rejectConversation(target)).toEqual({ success: true });
      expect(await result.current.deleteConversation(target)).toEqual({ success: true });
    });
    expect(mocks.finalization).toHaveBeenCalledTimes(2);

    mocks.actions.deleteConversationFull.mockImplementationOnce(() => {
      throw new Error('before reject finalization');
    });
    await act(async () => {
      expect(await result.current.rejectConversation(target)).toMatchObject({ success: false });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();

    mocks.actions.deleteConversationFull.mockReturnValueOnce(Promise.reject(new Error('after')));
    await act(async () => {
      expect(await result.current.deleteConversation(target)).toMatchObject({ success: false });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();

    mocks.actions.deleteConversationFull.mockReturnValueOnce(
      Promise.reject(new Error('after reject'))
    );
    await act(async () => {
      expect(await result.current.rejectConversation(target)).toMatchObject({ success: false });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });
});
