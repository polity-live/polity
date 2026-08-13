/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMessageInputController } from '../useMessageInputController';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../hooks/useMessageAttachments', () => ({
  useMessageAttachments: () => ({
    selectedAttachments: [],
    attachmentOptions: [],
    isUploadingAttachments: false,
    addAttachment: vi.fn(),
    clearAttachments: vi.fn(),
  }),
}));

const pendingConversation = {
  id: 'conversation-1',
  type: 'direct',
  status: 'pending',
  requested_by_id: 'user-sender',
  participants: [
    { user_id: 'user-sender', user: { id: 'user-sender', first_name: 'Sender' } },
    { user_id: 'user-recipient', user: { id: 'user-recipient', first_name: 'Recipient' } },
  ],
};

describe('useMessageInputController pending requests', () => {
  it('hides the composer from the recipient without a loaded requested_by relation', () => {
    const { result } = renderHook(() =>
      useMessageInputController({
        conversation: pendingConversation as any,
        currentUserId: 'user-recipient',
        onSendMessage: vi.fn(),
      })
    );

    expect(result.current).toBeNull();
  });

  it('keeps the composer available to the sender', () => {
    const { result } = renderHook(() =>
      useMessageInputController({
        conversation: pendingConversation as any,
        currentUserId: 'user-sender',
        onSendMessage: vi.fn(),
      })
    );

    expect(result.current?.isConversationRequester).toBe(true);
  });
});
