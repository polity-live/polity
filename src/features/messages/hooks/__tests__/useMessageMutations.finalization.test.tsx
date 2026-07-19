/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../../types/message.types';

const mocks = vi.hoisted(() => ({
  deleteConversationFull: vi.fn(),
  finalizationError: vi.fn(),
  finalizationSuccess: vi.fn(),
  loading: vi.fn(),
  rawToastError: vi.fn(),
  rawToastSuccess: vi.fn(),
  translations: {
    'common.creationFinalization.entities.conversation': 'Conversation',
    'features.messages.toasts.conversationDeleting': 'Deleting conversation…',
    'features.messages.toasts.conversationDeleted': 'Conversation deleted',
    'features.messages.toasts.conversationDeleteFailed': 'Failed to delete conversation',
    'features.messages.toasts.conversationRejecting': 'Rejecting conversation…',
    'features.messages.toasts.conversationRejected': 'Conversation rejected',
    'features.messages.toasts.conversationRejectFailed': 'Failed to reject conversation',
  } as Record<string, string>,
}));

vi.mock('@/zero/messages/useMessageActions', () => ({
  useMessageActions: () => ({
    deleteConversationFull: mocks.deleteConversationFull,
  }),
}));

vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: {
    finalizationError: mocks.finalizationError,
    finalizationSuccess: mocks.finalizationSuccess,
    loading: mocks.loading,
  },
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: {
    error: mocks.rawToastError,
    success: mocks.rawToastSuccess,
  },
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: { client?: Promise<unknown> }) => result.client ?? Promise.resolve(),
  toMutationError: (message?: string | null) => new Error(message ?? 'Mutation failed'),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => mocks.translations[key] ?? key,
}));

import { useMessageMutations } from '../useMessageMutations';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const conversation = {
  id: 'conversation-1',
  messages: [{ id: 'message-1' }],
  participants: [{ id: 'participant-1' }],
} as unknown as Conversation;

describe('useMessageMutations conversation finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('updates one deletion toast after both client and server succeed', async () => {
    const client = deferred<undefined>();
    const server = deferred<{ readonly type: 'success' }>();
    mocks.deleteConversationFull.mockReturnValue({
      client: client.promise,
      server: server.promise,
    });
    const { result } = renderHook(() => useMessageMutations());

    let deletion!: Promise<{ success: boolean; error?: unknown }>;
    act(() => {
      deletion = result.current.deleteConversation(conversation);
    });

    const toastId = 'creation:conversation:delete:conversation-1';
    expect(mocks.loading).toHaveBeenCalledOnce();
    expect(mocks.loading).toHaveBeenCalledWith(
      'Deleting conversation…',
      expect.objectContaining({ id: toastId })
    );

    server.resolve({ type: 'success' });
    await act(async () => Promise.resolve());
    expect(mocks.finalizationSuccess).not.toHaveBeenCalled();

    await act(async () => {
      client.resolve(undefined);
      await deletion;
    });
    await waitFor(() => expect(mocks.finalizationSuccess).toHaveBeenCalledOnce());
    expect(mocks.finalizationSuccess).toHaveBeenCalledWith(
      'Conversation deleted',
      expect.objectContaining({ id: toastId })
    );
    expect(mocks.finalizationError).not.toHaveBeenCalled();
    expect(mocks.rawToastSuccess).not.toHaveBeenCalled();
    expect(mocks.rawToastError).not.toHaveBeenCalled();
  });

  it('turns the deletion toast into one error on server rejection', async () => {
    mocks.deleteConversationFull.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({
        type: 'error' as const,
        error: { type: 'server' as const, message: 'Denied' },
      }),
    });
    const { result } = renderHook(() => useMessageMutations());

    await act(async () => {
      await result.current.deleteConversation(conversation);
    });

    await waitFor(() => expect(mocks.finalizationError).toHaveBeenCalledOnce());
    expect(mocks.finalizationError).toHaveBeenCalledWith(
      'Failed to delete conversation',
      expect.objectContaining({
        id: 'creation:conversation:delete:conversation-1',
        description: 'Denied',
      })
    );
    expect(mocks.finalizationSuccess).not.toHaveBeenCalled();
    expect(mocks.rawToastError).not.toHaveBeenCalled();
  });

  it('turns the deletion toast into one error when the client apply fails', async () => {
    const client = deferred<undefined>();
    const server = deferred<{ readonly type: 'success' }>();
    mocks.deleteConversationFull.mockReturnValue({
      client: client.promise,
      server: server.promise,
    });
    const { result } = renderHook(() => useMessageMutations());

    let deletion!: Promise<{ success: boolean; error?: unknown }>;
    act(() => {
      deletion = result.current.deleteConversation(conversation);
    });
    await act(async () => {
      client.reject(new Error('Client apply failed'));
      await deletion;
    });

    await waitFor(() => expect(mocks.finalizationError).toHaveBeenCalledOnce());
    server.resolve({ type: 'success' });
    await act(async () => Promise.resolve());

    expect(mocks.finalizationError).toHaveBeenCalledOnce();
    expect(mocks.finalizationSuccess).not.toHaveBeenCalled();
    expect(mocks.rawToastError).not.toHaveBeenCalled();
  });

  it('uses one tracked toast with rejection-specific messages', async () => {
    mocks.deleteConversationFull.mockReturnValue({
      client: Promise.resolve(),
      server: Promise.resolve({ type: 'success' as const }),
    });
    const { result } = renderHook(() => useMessageMutations());

    await act(async () => {
      await result.current.rejectConversation(conversation);
    });

    const toastId = 'creation:conversation:reject:conversation-1';
    expect(mocks.loading).toHaveBeenCalledWith(
      'Rejecting conversation…',
      expect.objectContaining({ id: toastId })
    );
    await waitFor(() => expect(mocks.finalizationSuccess).toHaveBeenCalledOnce());
    expect(mocks.finalizationSuccess).toHaveBeenCalledWith(
      'Conversation rejected',
      expect.objectContaining({ id: toastId })
    );
    expect(mocks.rawToastSuccess).not.toHaveBeenCalled();
    expect(mocks.rawToastError).not.toHaveBeenCalled();
  });

  it('falls back to a direct error toast when tracking never starts', async () => {
    mocks.deleteConversationFull.mockImplementationOnce(() => {
      throw new Error('Synchronous failure');
    });
    const { result } = renderHook(() => useMessageMutations());

    await act(async () => {
      await result.current.deleteConversation(conversation);
    });

    expect(mocks.loading).not.toHaveBeenCalled();
    expect(mocks.rawToastError).toHaveBeenCalledOnce();
    expect(mocks.rawToastError).toHaveBeenCalledWith('Failed to delete conversation');
  });
});
