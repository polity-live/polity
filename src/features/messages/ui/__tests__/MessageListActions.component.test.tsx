/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageListView, StreamingBubble } from '../MessageListView';

afterEach(cleanup);

const t = (key: string) => key;

describe('message list action contracts', () => {
  it('toggles assistant activity and retries a failed stream through stable controls', () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(
      <StreamingBubble
        streamingAssistantMessage={{
          text: '',
          isCompressing: false,
          isThinking: true,
          isToolCalling: false,
          toolPreview: 'step one',
          errorMessage: 'Connection interrupted',
          canRetry: true,
          onRetry,
        }}
        otherUser={{ id: 'assistant', first_name: 'Aria', avatar: null } as any}
        hidePolityLinkPreviews
      />
    );

    const activity = document.querySelector(
      '[data-action-id="messages.assistant.activity.toggle"]'
    ) as HTMLElement;
    activity.focus();
    expect(document.activeElement).toBe(activity);
    fireEvent.click(activity);
    fireEvent.click(document.querySelector('[data-action-id="messages.assistant.retry"]')!);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('scrolls to newly received messages without timing assumptions', () => {
    const scrollToBottom = vi.fn();
    render(
      <MessageListView
        {...({
          conversation: { id: 'conversation-1', type: 'direct', participants: [] },
          currentUserId: 'user-1',
          onAcceptConversation: vi.fn(),
          onRejectConversation: vi.fn(),
          resolveAttachmentCardData: undefined,
          t,
          scrollRef: { current: null },
          hasNewMessages: true,
          otherUser: null,
          otherParticipantName: 'Ada',
          virtualRows: [],
          spaceBefore: 0,
          spaceAfter: 0,
          rowsEmpty: true,
          scrollToBottom,
          handleScroll: vi.fn(),
        } as any)}
      />
    );

    const scroll = document.querySelector(
      '[data-action-id="messages.conversation.new-messages.scroll"]'
    ) as HTMLElement;
    fireEvent.click(scroll);
    expect(scrollToBottom).toHaveBeenCalledOnce();
  });
});
