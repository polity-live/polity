/* @vitest-environment jsdom */

import { createRef } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
  it('hides the route title and places rounded-corner conversation actions right of search', () => {
    const { container } = render(
      <ConversationListView
        className=""
        conversationFilter="all"
        conversationOnlineStatus={{}}
        conversations={[]}
        currentUserId="user-1"
        filterButtons={['all']}
        onConversationFilterChange={vi.fn()}
        onDeleteConversationClick={vi.fn()}
        onNewAiConversationClick={vi.fn()}
        onNewConversationClick={vi.fn()}
        onSearchChange={vi.fn()}
        onSelectConversation={vi.fn()}
        rowVirtualizer={{
          getTotalSize: () => 0,
          getVirtualItems: () => [],
          measureElement: vi.fn(),
        }}
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

    expect(searchRow?.className).toContain('items-center');
    expect(searchRow?.children[0]?.contains(search)).toBe(true);
    expect(searchRow?.children[1]?.contains(startButton)).toBe(true);
    expect(searchRow?.children[1]?.contains(aiButton)).toBe(true);
    expect(startButton.className).not.toContain('rounded-full');
    expect(aiButton.className).not.toContain('rounded-full');
  });
});
