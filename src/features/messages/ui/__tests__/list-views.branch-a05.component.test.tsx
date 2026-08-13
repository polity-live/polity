// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationListView } from '../ConversationListView';
import { NewConversationDialogView } from '../NewConversationDialogView';

const mocks = vi.hoisted(() => ({ items: [] as any[] }));

vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  CardHeader: ({ children }: any) => <header>{children}</header>,
}));
vi.mock('@/features/shared/ui/ui/separator', () => ({ Separator: () => <hr /> }));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/ui/skeleton', () => ({ Skeleton: () => <i /> }));
vi.mock('@/features/shared/utils/utils', () => ({
  cn: (...v: unknown[]) => v.filter(Boolean).join(' '),
}));
vi.mock('../ConversationItem', () => ({
  ConversationItem: (props: any) => {
    mocks.items.push(props);
    return <div>{props.conversation.id}</div>;
  },
}));
vi.mock('@/features/shared/virtualization', () => ({
  rowAttributes: (index: number, key: unknown) => ({ 'data-row': `${index}:${String(key)}` }),
  ZeroVirtualSpacer: ({ position, size }: any) => <div>{`${position}:${size}`}</div>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <>{children}</>,
  DialogHeader: ({ children }: any) => <>{children}</>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));
vi.mock('@/features/shared/ui/ui/avatar', () => ({
  Avatar: ({ children }: any) => <span>{children}</span>,
  AvatarImage: ({ src }: any) => <i data-src={src} />,
  AvatarFallback: ({ children }: any) => <b>{children}</b>,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function props(overrides: Record<string, unknown> = {}) {
  return {
    className: undefined,
    conversationFilter: 'all',
    conversationOnlineStatus: {},
    conversations: [],
    currentUserId: 'viewer',
    filterButtons: ['all', 'direct'],
    onConversationFilterChange: vi.fn(),
    onDeleteConversationClick: vi.fn(),
    onNewAiConversationClick: vi.fn(),
    onNewConversationClick: vi.fn(),
    onSearchChange: vi.fn(),
    onSelectConversation: vi.fn(),
    virtualItems: [],
    spaceBefore: 0,
    spaceAfter: 0,
    rowsEmpty: true,
    scrollRef: createRef<HTMLDivElement>(),
    searchQuery: '',
    selectedConversationId: null,
    t: (key: string) => key,
    ...overrides,
  } as any;
}

afterEach(() => {
  cleanup();
  mocks.items = [];
});

describe('message list views exhaustive branches', () => {
  it('renders concealed mobile, skeleton and both empty-state messages', () => {
    const rendered = render(
      <ConversationListView
        {...props({ isMobileScreen: true, selectedConversationId: 'selected', isLoading: true })}
      />
    );
    expect(document.querySelector('[data-slot="conversation-list-skeleton"]')).toBeTruthy();
    expect(document.querySelector('section')?.getAttribute('aria-hidden')).toBe('true');

    rendered.rerender(<ConversationListView {...props({ searchQuery: 'find' })} />);
    expect(document.body.textContent).toContain('features.messages.noConversationsFound');
    rendered.rerender(<ConversationListView {...props({ conversationFilter: 'direct' })} />);
    expect(document.body.textContent).toContain('features.messages.noConversationsFound');
    rendered.rerender(<ConversationListView {...props()} />);
    expect(document.body.textContent).toContain('features.messages.noConversations');
  });

  it('renders loaded and pending virtual rows, defaults, online fallback and handlers', () => {
    const onSearchChange = vi.fn(),
      onFilter = vi.fn(),
      onNew = vi.fn(),
      onAi = vi.fn();
    const conversation = { id: 'one' };
    const rendered = render(
      <ConversationListView
        {...props({
          conversations: [conversation],
          rowsEmpty: false,
          onSearchChange,
          onConversationFilterChange: onFilter,
          onNewConversationClick: onNew,
          onNewAiConversationClick: onAi,
          selectedConversationId: 'one',
          virtualItems: [
            { key: 'loaded', index: 1, row: conversation },
            { key: 'pending', index: 2, row: undefined },
          ],
          spaceBefore: 3,
          spaceAfter: 4,
        })}
      />
    );
    expect(mocks.items[0]).toMatchObject({ isOnline: false, isSelected: true });
    expect(document.querySelector('[data-row="1:loaded"]')?.getAttribute('style')).toContain(
      'margin-top'
    );
    expect(document.querySelector('[data-row="2:pending"]')?.getAttribute('style')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('features.messages.searchConversations'), {
      target: { value: 'next' },
    });
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.filter.select"]')!
    );
    fireEvent.click(
      document.querySelector('[data-action-id="messages.conversation.create.open"]')!
    );
    fireEvent.click(document.querySelector('[data-action-id="messages.ai-conversation.create"]')!);
    expect(onSearchChange).toHaveBeenCalledWith('next');
    expect(onFilter).toHaveBeenCalled();
    expect(onNew).toHaveBeenCalled();
    expect(onAi).toHaveBeenCalled();

    rendered.rerender(
      <ConversationListView
        {...props({
          conversations: [],
          virtualItems: undefined,
          spaceBefore: undefined,
          spaceAfter: undefined,
          rowsEmpty: undefined,
        })}
      />
    );
    expect(document.body.textContent).toContain('features.messages.noConversations');
    rendered.rerender(
      <ConversationListView
        {...props({
          conversations: [conversation],
          rowsEmpty: undefined,
          conversationOnlineStatus: { one: true },
          virtualItems: [{ key: 'one', index: 0, row: conversation }],
        })}
      />
    );
    expect(mocks.items.at(-1)).toMatchObject({ isOnline: true, isSelected: false });
  });

  it('covers empty, targeted and populated new-conversation states', () => {
    const onSearch = vi.fn(),
      onSelect = vi.fn();
    const rendered = render(
      <NewConversationDialogView
        open
        onOpenChange={vi.fn()}
        onUserSelect={onSelect}
        userSearchQuery=""
        onUserSearchQueryChange={onSearch}
        filteredUsers={[]}
        isTargetedSearch={false}
      />
    );
    expect(document.body.textContent).toContain('features.messages.compose.startTyping');
    rendered.rerender(
      <NewConversationDialogView
        open
        onOpenChange={vi.fn()}
        onUserSelect={onSelect}
        userSearchQuery="find"
        onUserSearchQueryChange={onSearch}
        filteredUsers={[]}
        isTargetedSearch={false}
      />
    );
    expect(document.body.textContent).toContain('features.messages.compose.noUsersFound');
    rendered.rerender(
      <NewConversationDialogView
        open
        onOpenChange={vi.fn()}
        onUserSelect={onSelect}
        userSearchQuery=""
        onUserSearchQueryChange={onSearch}
        filteredUsers={[]}
        isTargetedSearch
      />
    );
    expect(document.body.textContent).toContain('features.messages.compose.noUsersFound');
    rendered.rerender(
      <NewConversationDialogView
        open
        onOpenChange={vi.fn()}
        onUserSelect={onSelect}
        userSearchQuery=""
        onUserSearchQueryChange={onSearch}
        isTargetedSearch={false}
        filteredUsers={
          [
            { id: 'one', first_name: 'alice', last_name: 'Example', avatar: null, handle: 'alice' },
            { id: 'two', first_name: null, last_name: null, avatar: '/avatar', handle: null },
          ] as any
        }
      />
    );
    expect(document.body.textContent).toContain('alice Example');
    expect(document.body.textContent).toContain('common.labels.unspecifiedUser');
    fireEvent.click(
      document.querySelector('[data-action-id="messages.new-conversation.user.select"]')!
    );
    fireEvent.change(
      screen.getByPlaceholderText('features.messages.compose.searchUsersPlaceholder'),
      { target: { value: 'query' } }
    );
    expect(onSelect).toHaveBeenCalledWith('one');
    expect(onSearch).toHaveBeenCalledWith('query');
  });
});
