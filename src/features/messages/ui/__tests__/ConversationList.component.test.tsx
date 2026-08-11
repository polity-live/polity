/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationList } from '../ConversationList';

const captured = vi.hoisted(() => ({
  isMobileScreen: false,
  listOptions: [] as any[],
  viewProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/hooks/useIsMobileScreen', () => ({
  useIsMobileScreen: () => captured.isMobileScreen,
}));

vi.mock('@/features/shared/virtualization', () => ({
  usePolityZeroList: (options: any) => {
    captured.listOptions.push(options);
    return {
      items: [],
      rowsEmpty: true,
      spaceAfter: 0,
      spaceBefore: 0,
    };
  },
}));

vi.mock('@/zero/queries', () => ({
  queries: {
    messages: {
      conversationById: vi.fn(),
      conversationPage: vi.fn(),
    },
  },
}));

vi.mock('../ConversationListView', () => ({
  ConversationListView: (props: any) => {
    captured.viewProps = props;
    return <div data-testid="conversation-list-view" />;
  },
}));

const baseProps = {
  conversations: [],
  conversationOnlineStatus: {},
  selectedConversationId: null,
  onSelectConversation: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  conversationFilter: 'all' as const,
  onConversationFilterChange: vi.fn(),
  currentUserId: 'user-1',
  onNewConversationClick: vi.fn(),
  onNewAiConversationClick: vi.fn(),
  onDeleteConversationClick: vi.fn(),
};

describe('ConversationList virtual permalink behavior', () => {
  beforeEach(() => {
    captured.isMobileScreen = false;
    captured.listOptions = [];
    captured.viewProps = undefined;
  });

  afterEach(cleanup);

  it('keeps the selected conversation out of the virtual permalink on mobile', () => {
    captured.isMobileScreen = true;
    const { rerender } = render(<ConversationList {...baseProps} />);

    rerender(<ConversationList {...baseProps} selectedConversationId="conversation-1" />);

    expect(captured.listOptions.at(-1)?.permalinkID).toBeUndefined();
    expect(captured.viewProps.selectedConversationId).toBe('conversation-1');
  });

  it('keeps desktop selection synchronized with the virtual permalink', () => {
    render(<ConversationList {...baseProps} selectedConversationId="conversation-1" />);

    expect(captured.listOptions.at(-1)?.permalinkID).toBe('conversation-1');
    expect(captured.viewProps.selectedConversationId).toBe('conversation-1');
  });
});
