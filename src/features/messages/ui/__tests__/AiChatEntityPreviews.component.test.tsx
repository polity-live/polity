/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { MessageBubble } from '../MessageBubble';
import { StreamingBubble } from '../MessageListView';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ alt = '', ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} {...props} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../LinkPreview.tsx', () => ({
  LinkPreview: ({ url }: { url: string }) => <div data-testid="link-preview">{url}</div>,
}));

afterEach(cleanup);

const message = {
  id: 'message-1',
  content: 'See /group/group-1 and https://example.com',
  context_json: '[]',
  created_at: Date.now(),
  sender: {
    id: 'user-1',
    first_name: 'User',
    avatar: null,
  },
};

describe('AI chat entity previews', () => {
  it('suppresses Polity previews in persisted AI messages but not normal conversations', () => {
    const { unmount } = render(
      <MessageBubble message={message as never} isOwnMessage isAssistantConversation />
    );

    expect(screen.getAllByTestId('link-preview')).toHaveLength(1);
    expect(screen.getByTestId('link-preview').textContent).toBe('https://example.com');

    unmount();
    render(<MessageBubble message={message as never} isOwnMessage />);
    expect(screen.getAllByTestId('link-preview')).toHaveLength(2);
  });

  it('suppresses Polity previews while the AI response is streaming', () => {
    const { container } = render(
      <StreamingBubble
        streamingAssistantMessage={{
          text: 'See /event/event-1 and https://example.com',
          isCompressing: false,
          isThinking: false,
          isToolCalling: false,
        }}
        otherUser={{ id: ARIA_KAI_USER_ID, first_name: 'Aria', avatar: null } as never}
        hidePolityLinkPreviews
      />
    );

    expect(screen.getAllByTestId('link-preview')).toHaveLength(1);
    expect(screen.getByTestId('link-preview').textContent).toBe('https://example.com');
    expect(container.querySelector(`img[src="${ARIA_KAI_AVATAR_URL}"]`)).toBeTruthy();
  });

  it('renders persisted output cards with assistant text and without text', () => {
    const contextJson = JSON.stringify({
      version: 1,
      attachments: [
        {
          entityType: 'group',
          entityId: 'group-created',
          title: 'Created group',
          context_type: 'output',
          href: '/group/group-created',
        },
      ],
      presentations: [],
    });
    const assistantMessage = {
      ...message,
      id: 'assistant-message-with-text',
      content: 'Die Gruppe wurde erstellt.',
      context_json: contextJson,
      sender: { ...message.sender, id: ARIA_KAI_USER_ID, first_name: 'Aria' },
    };

    const { container, unmount } = render(
      <MessageBubble
        message={assistantMessage as never}
        isOwnMessage={false}
        isAssistantConversation
      />
    );

    expect(screen.getByText('Die Gruppe wurde erstellt.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Created group/ }).getAttribute('href')).toBe(
      '/group/group-created'
    );
    expect(container.querySelector(`img[src="${ARIA_KAI_AVATAR_URL}"]`)).toBeTruthy();

    unmount();
    render(
      <MessageBubble
        message={{ ...assistantMessage, id: 'assistant-message-card-only', content: '' } as never}
        isOwnMessage={false}
        isAssistantConversation
      />
    );

    expect(screen.getByRole('link', { name: /Created group/ }).getAttribute('href')).toBe(
      '/group/group-created'
    );
  });
});
