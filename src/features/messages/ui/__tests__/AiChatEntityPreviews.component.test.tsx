import { ProjectContextNavigation } from '@/features/project-chat/ui/ProjectContextNavigation';
/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARIA_KAI_AVATAR_URL, ARIA_KAI_USER_ID } from '@/features/assistant/constants';
import { MessageBubble } from '../MessageBubble';
import { StreamingBubble } from '../MessageListView';
import { translate } from '@/features/shared/hooks/use-translation';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ session: null }) }));
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

it('activates the exact stored element context from a sent message', () => {
  const reference = { kind: 'element', id: 'title', label: 'Heading', origin: 'automatic' };
  const editorContext = { surface: 'studio', proposalId: null, references: [reference] };
  const activate = vi.fn();
  render(
    <ProjectContextNavigation.Provider value={activate}>
      <MessageBubble
        message={
          { ...message, context_json: JSON.stringify({ project: { editorContext } }) } as never
        }
        isOwnMessage
      />
    </ProjectContextNavigation.Provider>
  );
  fireEvent.click(screen.getByRole('button', { name: /Heading/ }));
  expect(activate).toHaveBeenCalledWith(reference, editorContext);
});

it.each(['proposed', 'needs_clarification', 'failed'] as const)(
  'renders the stored project outcome %s while preserving the message content',
  outcome => {
    render(
      <MessageBubble
        message={
          {
            ...message,
            content: 'Stored project response',
            context_json: JSON.stringify({ project: { outcome } }),
          } as never
        }
        isOwnMessage={false}
      />
    );
    expect(screen.getByText('Stored project response')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      translate(`features.projectChat.context.${outcome}`)
    );
  }
);
