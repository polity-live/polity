// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageBubble } from '../MessageBubble';
import { MessageView } from '../MessageView';

const mocks = vi.hoisted(() => ({
  assistantUser: false,
  assistantConversation: false,
  error: false,
  contents: [] as any[],
  contexts: [] as any[],
  views: [] as any[],
}));

vi.mock('@/features/assistant/logic/assistantHelpers', () => ({
  isAssistantUser: () => mocks.assistantUser,
  resolveAssistantAvatar: (_id: unknown, avatar: unknown) => avatar ?? null,
  isAssistantConversation: () => mocks.assistantConversation,
}));
vi.mock('../../logic/contextAttachments', () => ({ isAssistantErrorContext: () => mocks.error }));
vi.mock('../MessageContent.tsx', () => ({
  MessageContent: (props: any) => {
    mocks.contents.push(props);
    return <div>content</div>;
  },
}));
vi.mock('../AiContextCards', () => ({
  AiContextCards: (props: any) => {
    mocks.contexts.push(props);
    return <div>context</div>;
  },
}));
vi.mock('../../logic/messageUtils', () => ({
  formatTime: (value: unknown) => `time:${String(value)}`,
}));
vi.mock('@/features/shared/theme', () => ({ featureThemeClassName: (name: string) => name }));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...v: unknown[]) => v.filter(Boolean).join(' '),
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <i data-src={src} />,
  AvatarFallback: ({ children }: any) => <b>{children}</b>,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, ...props }: any) => <section {...props}>{children}</section>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <i /> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../ConversationHeader', () => ({
  ConversationHeader: (props: any) => {
    mocks.views.push(['header', props]);
    return <div>header</div>;
  },
}));
vi.mock('../MessageList', () => ({
  MessageList: (props: any) => {
    mocks.views.push(['list', props]);
    return <div>list</div>;
  },
}));
vi.mock('../MessageInput', () => ({
  MessageInput: (props: any) => {
    mocks.views.push(['input', props]);
    return <div>input</div>;
  },
}));
vi.mock('../AssistantMessageView', () => ({
  AssistantMessageView: (props: any) => {
    mocks.views.push(['assistant', props]);
    return <div>assistant</div>;
  },
}));

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message',
    content: '',
    created_at: 1,
    context_json: null,
    sender: null,
    ...overrides,
  } as any;
}
function viewProps(overrides: Record<string, unknown> = {}) {
  return {
    isConversationUserOnline: false,
    onBack: vi.fn(),
    onTogglePin: vi.fn(),
    onDeleteClick: vi.fn(),
    onMembersClick: vi.fn(),
    onRenameConversation: vi.fn(async () => true),
    onSendMessage: vi.fn(async () => true),
    onAcceptConversation: vi.fn(),
    onRejectConversation: vi.fn(),
    ...overrides,
  } as any;
}

describe('message bubble and view exhaustive branches', () => {
  beforeEach(() => {
    mocks.assistantUser = false;
    mocks.assistantConversation = false;
    mocks.error = false;
    mocks.contents = [];
    mocks.contexts = [];
    mocks.views = [];
  });
  afterEach(cleanup);

  it('renders empty, own, flat assistant, normal and error bubbles', () => {
    const rendered = render(
      <MessageBubble message={message({ content: null })} isOwnMessage={false} />
    );
    expect(document.body.textContent).toContain('time:1');
    expect(mocks.contexts[0].contextLabel).toBe('input');
    rendered.rerender(<MessageBubble message={message()} isOwnMessage />);
    expect(document.body.innerHTML).toContain('text-right');

    mocks.assistantUser = true;
    rendered.rerender(
      <MessageBubble
        message={message({
          content: 'Own',
          sender: { id: 'assistant', first_name: 'a', avatar: '/a' },
        })}
        isOwnMessage
        isAssistantConversation
      />
    );
    expect(mocks.contents.at(-1)).toMatchObject({
      renderMarkdown: true,
      hidePolityLinkPreviews: true,
    });

    rendered.rerender(
      <MessageBubble
        message={message({ content: 'Flat', sender: { id: 'assistant' } })}
        isOwnMessage={false}
        isAssistantConversation
      />
    );
    expect(document.body.innerHTML).toContain('max-w-3xl');

    mocks.assistantConversation = false;
    mocks.assistantUser = false;
    rendered.rerender(
      <MessageBubble
        message={message({ content: 'Normal', sender: { id: 'user' } })}
        isOwnMessage={false}
      />
    );
    mocks.error = true;
    rendered.rerender(
      <MessageBubble
        message={message({ content: 'Error', context_json: 'error', sender: { id: 'user' } })}
        isOwnMessage={false}
        isAssistantConversation
      />
    );
    expect(document.body.innerHTML).toContain('messageMessageBubbleDangerBadge');
  });

  it('renders empty, assistant, loading and loaded message views', () => {
    const conversation = { id: 'conversation' } as any;
    const rendered = render(<MessageView {...viewProps()} />);
    expect(document.body.textContent).toContain('features.messages.conversation.selectDescription');

    mocks.assistantConversation = true;
    rendered.rerender(<MessageView {...viewProps({ conversation, className: 'custom' })} />);
    expect(mocks.views.at(-1)?.[0]).toBe('assistant');

    mocks.assistantConversation = false;
    rendered.rerender(<MessageView {...viewProps({ conversation, isThreadLoading: true })} />);
    expect(document.querySelector('[data-slot="message-thread-skeleton"]')).toBeTruthy();
    rendered.rerender(
      <MessageView
        {...viewProps({
          conversation,
          isThreadLoading: false,
          swipeHandlers: { onTouchStart: vi.fn() },
        })}
      />
    );
    expect(screen.getByText('list')).toBeTruthy();
    expect(screen.getByText('input')).toBeTruthy();
  });
});
