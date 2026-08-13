// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageListView, StreamingBubble } from '../MessageListView';

const mocks = vi.hoisted(() => ({ bubbles: [] as any[], requester: false, assistant: false }));

vi.mock('../MessageBubble', () => ({
  MessageBubble: (props: any) => {
    mocks.bubbles.push(props);
    return <div>message-bubble</div>;
  },
}));
vi.mock('../../logic/messageUtils', () => ({
  getOtherParticipant: () => null,
  isConversationRequester: () => mocks.requester,
}));
vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantConversation: () => mocks.assistant,
  resolveAssistantAvatar: (_id: unknown, avatar: unknown) => avatar ?? null,
}));
vi.mock('../MessageContent.tsx', () => ({
  MessageContent: ({ content }: any) => <div>{content}</div>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <i data-src={src} />,
  AvatarFallback: ({ children }: any) => <b>{children}</b>,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <section>{children}</section>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <i /> }));
vi.mock('@/features/shared/virtualization', () => ({
  rowAttributes: (index: number, key: unknown) => ({ 'data-row': `${index}:${String(key)}` }),
  ZeroVirtualSpacer: ({ position, size }: any) => <div>{`${position}:${size}`}</div>,
}));
vi.mock('@/features/app-tutorial/fixture-copy', () => ({
  resolveAppTutorialFixtureValue: (value: unknown) => value,
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (name: string) => name }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, values?: any) => `${key}:${values?.tool ?? ''}`,
  }),
  translate: (key: string) => key,
}));

function streaming(overrides: Record<string, unknown> = {}) {
  return {
    text: '',
    isCompressing: false,
    isThinking: false,
    isToolCalling: false,
    ...overrides,
  } as any;
}
function props(overrides: Record<string, unknown> = {}) {
  return {
    conversation: { id: 'conversation', tutorial_run_id: null },
    currentUserId: 'viewer',
    onAcceptConversation: vi.fn(),
    onRejectConversation: vi.fn(),
    resolveAttachmentCardData: vi.fn(),
    t: (key: string) => key,
    scrollRef: createRef<HTMLDivElement>(),
    hasNewMessages: false,
    otherUser: null,
    otherParticipantName: 'Other',
    virtualRows: [],
    spaceBefore: 0,
    spaceAfter: 0,
    rowsEmpty: true,
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
    ...overrides,
  } as any;
}

describe('MessageListView exhaustive branches', () => {
  beforeEach(() => {
    mocks.bubbles = [];
    mocks.requester = false;
    mocks.assistant = false;
  });
  afterEach(cleanup);

  it('covers absent user and every streaming activity/error presentation', () => {
    const rendered = render(
      <StreamingBubble
        streamingAssistantMessage={streaming()}
        otherUser={null}
        hidePolityLinkPreviews={false}
      />
    );
    expect(rendered.container.childElementCount).toBe(0);
    const other = { id: 'assistant', avatar: null, first_name: null } as any;
    for (const state of [
      streaming({ text: 'Text', isThinking: true }),
      streaming({ isCompressing: true }),
      streaming({ isToolCalling: true, toolName: 'search', toolPreview: 'preview' }),
      streaming({ isToolCalling: true, toolName: null }),
      streaming({ errorMessage: 'Error', canRetry: false }),
      streaming({ errorMessage: 'Retry', canRetry: true, onRetry: vi.fn(async () => true) }),
      streaming({ errorMessage: 'No callback', canRetry: true, onRetry: undefined }),
    ]) {
      rendered.rerender(
        <StreamingBubble
          streamingAssistantMessage={state}
          otherUser={other}
          hidePolityLinkPreviews
        />
      );
    }
    expect(document.body.textContent).toContain('No callback');
    const retryState = streaming({
      errorMessage: 'Retry',
      canRetry: true,
      onRetry: vi.fn(async () => true),
    });
    rendered.rerender(
      <StreamingBubble
        streamingAssistantMessage={retryState}
        otherUser={other}
        hidePolityLinkPreviews
      />
    );
    fireEvent.click(document.querySelector('[data-action-id="messages.assistant.retry"]')!);
    expect(retryState.onRetry).toHaveBeenCalled();
  });

  it('renders new-message, empty, loaded, pending, streaming and recipient request rows', () => {
    const scroll = vi.fn(),
      accept = vi.fn(),
      reject = vi.fn(),
      handleScroll = vi.fn();
    const rendered = render(
      <MessageListView {...props({ hasNewMessages: true, scrollToBottom: scroll, handleScroll })} />
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.new-messages.scroll"]')!
    );
    expect(scroll).toHaveBeenCalled();
    expect(document.body.textContent).toContain('features.messages.conversation.noMessagesYet');

    const message = { id: 'message', sender: { id: 'viewer' } };
    rendered.rerender(
      <MessageListView
        {...props({
          rowsEmpty: false,
          onAcceptConversation: accept,
          onRejectConversation: reject,
          otherUser: { id: 'assistant', first_name: 'A' },
          virtualRows: [
            { type: 'message', key: 'loaded', index: 1, message },
            { type: 'message', key: 'pending', index: 2, message: undefined },
            { type: 'streaming', key: 'stream', streaming: streaming({ text: 'Stream' }) },
            { type: 'conversation-request', key: 'request' },
            { type: 'other', key: 'other' },
          ],
        })}
      />
    );
    expect(mocks.bubbles[0]).toMatchObject({ isOwnMessage: true, isAssistantConversation: false });
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation-request.accept"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation-request.reject"]')!
    );
    expect(accept).toHaveBeenCalled();
    expect(reject).toHaveBeenCalled();

    mocks.requester = true;
    mocks.assistant = true;
    rendered.rerender(
      <MessageListView
        {...props({
          rowsEmpty: false,
          virtualRows: [{ type: 'conversation-request', key: 'request' }],
        })}
      />
    );
    expect(document.body.textContent).toContain('features.messages.conversation.waitingForAccept');
  });
});
