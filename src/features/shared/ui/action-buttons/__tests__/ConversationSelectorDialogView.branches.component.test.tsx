// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <header>{children}</header>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}));

vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AvatarFallback: ({ children }: React.PropsWithChildren) => (
    <span data-testid="fallback">{children}</span>
  ),
  AvatarImage: ({ src }: { src?: string }) => <span data-testid="avatar">{String(src)}</span>,
}));

vi.mock('@/features/shared/ui/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/features/shared/ui/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  SectionSkeleton: ({ label }: { label: string }) => <div data-testid="skeleton">{label}</div>,
}));

vi.mock('lucide-react', () => ({
  MessageSquare: () => <i data-testid="message" />,
  Search: () => <i data-testid="search-icon" />,
}));

import { ConversationSelectorDialogView } from '../ConversationSelectorDialogView';

function props(overrides: Record<string, unknown> = {}) {
  return {
    conversations: [],
    emptyLabel: undefined,
    filteredConversations: [],
    handleShareToConversation: vi.fn(),
    isLoading: false,
    loadingLabel: undefined,
    onOpenChange: vi.fn(),
    onShareToConversation: vi.fn(),
    open: true,
    searchPlaceholder: undefined,
    searchQuery: '',
    sending: null,
    setSearchQuery: vi.fn(),
    setSending: vi.fn(),
    shareContextItem: null,
    shareDescription: '',
    shareTitle: 'Share title',
    shareUrl: '/share',
    t: (key: string) => `translated:${key}`,
    title: undefined,
    ...overrides,
  };
}

afterEach(cleanup);

describe('ConversationSelectorDialogView branch contracts', () => {
  it('uses translated title, placeholder, and loading label defaults', () => {
    const setSearchQuery = vi.fn();
    render(<ConversationSelectorDialogView {...props({ isLoading: true, setSearchQuery })} />);
    expect(screen.getByText('translated:common.share.title')).toBeTruthy();
    expect(screen.getByText('translated:common.loading.conversations')).toBeTruthy();
    const input = screen.getByPlaceholderText('translated:common.share.searchConversations');
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(setSearchQuery).toHaveBeenCalledWith('Ada');
  });

  it('uses provided copy and distinguishes both empty search states', () => {
    const provided = render(
      <ConversationSelectorDialogView
        {...props({
          emptyLabel: 'Provided empty',
          loadingLabel: 'Provided loading',
          searchPlaceholder: 'Find a chat',
          title: 'Send to',
        })}
      />
    );
    expect(screen.getByText('Send to')).toBeTruthy();
    expect(screen.getByText('Provided empty')).toBeTruthy();
    expect(screen.getByPlaceholderText('Find a chat')).toBeTruthy();
    provided.unmount();

    const initial = render(<ConversationSelectorDialogView {...props()} />);
    expect(screen.getByText('translated:common.share.noConversationsYet')).toBeTruthy();
    initial.unmount();

    render(<ConversationSelectorDialogView {...props({ searchQuery: 'missing' })} />);
    expect(screen.getByText('translated:common.share.noConversationsFound')).toBeTruthy();
  });

  it('renders active, sending, pending, and unconfigured conversation actions', () => {
    const handleShare = vi.fn();
    const conversations = [
      {
        avatar: 'ada.png',
        handle: 'ada',
        id: 'active',
        isGroup: true,
        name: 'Ada',
        participantCount: 3,
        status: 'active',
      },
      {
        avatar: null,
        id: 'pending',
        isGroup: true,
        name: '',
        participantCount: undefined,
        status: 'pending',
      },
      {
        id: 'plain',
        isGroup: false,
        name: null,
        participantCount: 9,
        status: 'active',
      },
    ];
    const view = render(
      <ConversationSelectorDialogView
        {...props({
          filteredConversations: conversations,
          handleShareToConversation: handleShare,
          sending: 'active',
        })}
      />
    );

    expect(screen.getByText('@ada')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('translated:common.labels.pending')).toBeTruthy();
    expect(screen.getByText('translated:common.labels.sending')).toBeTruthy();
    expect(screen.getAllByTestId('fallback').map(node => node.textContent)).toEqual([
      'A',
      'U',
      'U',
    ]);
    expect(screen.getAllByTestId('avatar').map(node => node.textContent)).toEqual([
      'ada.png',
      'undefined',
      'undefined',
    ]);

    const buttons = screen.getAllByRole<HTMLButtonElement>('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[2].disabled).toBe(false);
    fireEvent.click(buttons[2]);
    expect(handleShare).toHaveBeenCalledWith('plain');
    view.unmount();

    render(
      <ConversationSelectorDialogView
        {...props({ filteredConversations: [conversations[2]], onShareToConversation: undefined })}
      />
    );
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });
});
