/* @vitest-environment jsdom */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutate: vi.fn((value: unknown) => ({ value })),
  onServerError: vi.fn((_result: unknown, callback: () => void) => callback()),
  track: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
const mutators = vi.hoisted(() => {
  const mutation = (name: string) => vi.fn((args: unknown) => ({ name, args }));
  return {
    createConversation: mutation('createConversation'),
    createConversationFull: mutation('createConversationFull'),
    updateConversation: mutation('updateConversation'),
    deleteConversation: mutation('deleteConversation'),
    deleteConversationFull: mutation('deleteConversationFull'),
    sendMessage: mutation('sendMessage'),
    sendAssistantMessage: mutation('sendAssistantMessage'),
    updateMessage: mutation('updateMessage'),
    deleteMessage: mutation('deleteMessage'),
    addParticipant: mutation('addParticipant'),
    removeParticipant: mutation('removeParticipant'),
    markRead: mutation('markRead'),
  };
});

vi.mock('@rocicorp/zero/react', () => ({ useZero: () => ({ mutate: mocks.mutate }) }));
vi.mock('@/features/notifications/utils/gated-toast', () => ({
  gatedToast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../mutators', () => ({ mutators: { messages: mutators } }));
vi.mock('../../mutate-with-server-check', () => ({ onServerError: mocks.onServerError }));
vi.mock('@/features/notifications/utils/mutation-finalization', () => ({
  trackCreationUnlessSilent: mocks.track,
}));

import { useMessageActions } from '../useMessageActions';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useMessageActions LSF action adapters', () => {
  it('executes every conversation, message, participant, and read-status adapter', () => {
    const { result } = renderHook(() => useMessageActions());
    const args = { id: 'entity-1' } as never;
    const options = { silent: true } as never;

    act(() => {
      result.current.createConversation(args, options);
      result.current.createConversationFull(args, options);
      result.current.updateConversation(args);
      result.current.deleteConversation(args);
      result.current.deleteConversationFull(args);
      result.current.sendMessage(args);
      result.current.sendAssistantMessage(args);
      result.current.updateMessage(args);
      result.current.deleteMessage(args);
      result.current.addParticipant(args, options);
      result.current.removeParticipant(args);
      result.current.markRead(args);
    });

    expect(mocks.mutate).toHaveBeenCalledTimes(12);
    expect(mocks.track).toHaveBeenCalledTimes(3);
    expect(mocks.onServerError).toHaveBeenCalledTimes(8);
    expect(mocks.success).toHaveBeenCalledTimes(3);
    expect(mocks.error).toHaveBeenCalledTimes(8);
  });
});
