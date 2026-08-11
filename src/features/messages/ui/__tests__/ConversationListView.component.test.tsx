/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConversationListView } from '../ConversationListView';

afterEach(cleanup);

const labels: Record<string, string> = {
  'features.messages.title': 'Messages',
  'features.messages.compose.startNewChat': 'Start conversation',
  'features.messages.compose.startNewAi': 'AI conversation',
  'features.messages.searchConversations': 'Search conversations...',
  'features.messages.filters.all': 'All',
};

describe('ConversationListView', () => {
  it('keeps the mobile list measurable but non-interactive while a thread is open', () => {
    const props = {
      className: '',
      conversationFilter: 'all',
      conversationOnlineStatus: {},
      conversations: [],
      currentUserId: 'user-1',
      filterButtons: ['all'],
      isMobileScreen: true,
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
      t: (key: string) => labels[key] ?? key,
    };
    const { container, rerender } = render(
      <ConversationListView {...props} selectedConversationId="conversation-1" />
    );
    const listCard = container.querySelector('[data-slot="card"]') as HTMLElement;

    expect(listCard.classList.contains('invisible')).toBe(true);
    expect(listCard.classList.contains('absolute')).toBe(true);
    expect(listCard.classList.contains('hidden')).toBe(false);
    expect(listCard.getAttribute('aria-hidden')).toBe('true');
    expect(listCard.hasAttribute('inert')).toBe(true);

    rerender(<ConversationListView {...props} selectedConversationId={null} />);

    expect(listCard.classList.contains('invisible')).toBe(false);
    expect(listCard.classList.contains('absolute')).toBe(false);
    expect(listCard.hasAttribute('aria-hidden')).toBe(false);
    expect(listCard.hasAttribute('inert')).toBe(false);
  });

  it('hides the route title and places rounded-corner conversation actions right of search', () => {
    const onConversationFilterChange = vi.fn();
    const onNewAiConversationClick = vi.fn();
    const onNewConversationClick = vi.fn();
    const { container } = render(
      <ConversationListView
        className=""
        conversationFilter="all"
        conversationOnlineStatus={{}}
        conversations={[]}
        currentUserId="user-1"
        filterButtons={['all']}
        onConversationFilterChange={onConversationFilterChange}
        onDeleteConversationClick={vi.fn()}
        onNewAiConversationClick={onNewAiConversationClick}
        onNewConversationClick={onNewConversationClick}
        onSearchChange={vi.fn()}
        onSelectConversation={vi.fn()}
        virtualItems={[]}
        spaceBefore={0}
        spaceAfter={0}
        rowsEmpty
        scrollRef={createRef<HTMLDivElement>()}
        searchQuery=""
        selectedConversationId={null}
        t={(key: string) => labels[key] ?? key}
      />
    );

    expect(screen.getByRole('heading', { name: 'Messages' }).className).toContain('sr-only');

    const searchRow = container.querySelector('[data-slot="conversation-search-row"]');
    const startButton = screen.getByRole('button', { name: 'Start conversation' });
    const aiButton = screen.getByRole('button', { name: 'AI conversation' });
    const search = screen.getByPlaceholderText('Search conversations...');
    const listCard = container.querySelector('[data-slot="card"]');
    const listHeader = container.querySelector('[data-slot="card-header"]');
    const listContent = container.querySelector(
      '[data-slot="card-header"] + [data-slot="separator"]'
    )?.nextElementSibling?.firstElementChild;

    expect(searchRow?.className).toContain('items-center');
    expect(searchRow?.children[0]?.contains(search)).toBe(true);
    expect(searchRow?.children[1]?.contains(startButton)).toBe(true);
    expect(searchRow?.children[1]?.contains(aiButton)).toBe(true);
    expect(startButton.className).not.toContain('rounded-full');
    expect(aiButton.className).not.toContain('rounded-full');
    expect(listCard?.className).toContain('rounded-none');
    expect(listCard?.className).toContain('border-0');
    expect(listCard?.className).toContain('bg-transparent');
    expect(listCard?.className).toContain('shadow-none');
    expect(listCard?.className).toContain('md:rounded-lg');
    expect(listCard?.className).toContain('md:border');
    expect(listCard?.className).toContain('md:bg-card');
    expect(listCard?.className).toContain('md:shadow-[var(--shadow-panel)]');
    expect(listHeader?.className).toContain('px-0');
    expect(listHeader?.className).toContain('md:px-6');
    expect(listContent?.className).toContain('py-4');
    expect(listContent?.className).toContain('md:p-4');

    expect(startButton.getAttribute('data-action-id')).toBe('messages.conversation.create.open');
    expect(aiButton.getAttribute('data-action-id')).toBe('messages.ai-conversation.create');
    fireEvent.click(startButton);
    fireEvent.click(aiButton);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onNewConversationClick).toHaveBeenCalledOnce();
    expect(onNewAiConversationClick).toHaveBeenCalledOnce();
    expect(onConversationFilterChange).toHaveBeenCalledWith('all');
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('data-action-id')).toBe(
      'messages.conversation.filter.select'
    );
  });

  it('renders zero-virtual extents as content spacers', () => {
    const { container } = render(
      <ConversationListView
        className=""
        conversationFilter="all"
        conversationOnlineStatus={{}}
        conversations={[{}]}
        currentUserId="user-1"
        filterButtons={['all']}
        onConversationFilterChange={vi.fn()}
        onDeleteConversationClick={vi.fn()}
        onNewAiConversationClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onSearchChange={vi.fn()}
        onSelectConversation={vi.fn()}
        virtualItems={[{ key: 'placeholder-0', index: 0, row: undefined }]}
        spaceBefore={24}
        spaceAfter={48}
        rowsEmpty={false}
        scrollRef={createRef<HTMLDivElement>()}
        searchQuery=""
        selectedConversationId={null}
        t={(key: string) => labels[key] ?? key}
      />
    );

    const row = container.querySelector('[data-vrow-index="0"]') as HTMLElement;
    const content = row.parentElement as HTMLElement;
    expect(content.style.paddingTop).toBe('');
    expect(content.style.paddingBottom).toBe('');
    expect(
      (content.querySelector('[data-zero-virtual-spacer="before"]') as HTMLElement).style.height
    ).toBe('24px');
    expect(
      (content.querySelector('[data-zero-virtual-spacer="after"]') as HTMLElement).style.height
    ).toBe('48px');
  });
});
