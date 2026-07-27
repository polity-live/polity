/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { LandingSocialAiPreview } from '../LandingSocialAiPreview';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/messages/ui/ConversationHeader', () => ({
  ConversationHeader: ({ conversation }: { conversation: any }) => {
    const assistant = conversation.participants.find(
      (participant: any) => participant.user_id === ARIA_KAI_USER_ID
    )?.user;

    return (
      <div
        data-testid="conversation-header"
        data-assistant-avatar={assistant?.avatar ?? undefined}
      />
    );
  },
}));

vi.mock('@/features/messages/ui/MessageBubble', () => ({
  MessageBubble: ({ message }: { message: any }) => (
    <div
      data-testid="message-bubble"
      data-sender={message.sender?.id}
      data-avatar={message.sender?.avatar ?? undefined}
    />
  ),
}));

vi.mock('@/features/messages/ui/AssistantMessageInput', () => ({
  AssistantMessageInput: () => null,
}));

afterEach(cleanup);

describe('LandingSocialAiPreview', () => {
  it('uses the shared avatar for the assistant header and response', () => {
    render(<LandingSocialAiPreview />);

    expect(screen.getByTestId('conversation-header').getAttribute('data-assistant-avatar')).toBe(
      ARIA_KAI_AVATAR_URL
    );

    const assistantMessage = screen
      .getAllByTestId('message-bubble')
      .find(message => message.getAttribute('data-sender') === ARIA_KAI_USER_ID);

    expect(assistantMessage?.getAttribute('data-avatar')).toBe(ARIA_KAI_AVATAR_URL);
  });
});
