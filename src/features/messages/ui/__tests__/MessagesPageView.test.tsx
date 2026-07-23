/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagesPageView } from '../MessagesPageView';

const captured = vi.hoisted(() => ({
  conversationListProps: undefined as any,
  messageViewProps: undefined as any,
  newConversationDialogProps: undefined as any,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string, fallback?: string) => fallback ?? key,
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../ConversationList', () => ({
  ConversationList: (props: any) => {
    captured.conversationListProps = props;
    return <div data-testid="conversation-list" data-loading={String(props.isLoading)} />;
  },
}));

vi.mock('../MessageView', () => ({
  MessageView: (props: any) => {
    captured.messageViewProps = props;
    return <div data-testid="message-view" data-loading={String(props.isThreadLoading)} />;
  },
}));

vi.mock('../NewConversationDialog', () => ({
  NewConversationDialog: (props: any) => {
    captured.newConversationDialogProps = props;
    return <div data-testid="new-conversation-dialog" />;
  },
}));

vi.mock('../GroupMembersDialog', () => ({
  GroupMembersDialog: () => <div data-testid="group-members-dialog" />,
}));

vi.mock('../DeleteConversationDialog', () => ({
  DeleteConversationDialog: () => <div data-testid="delete-conversation-dialog" />,
}));

const baseProps = {
  currentUserId: 'user-1',
  filteredConversations: [],
  conversationOnlineStatus: {},
  selectedConversationId: null,
  onSelectConversation: vi.fn(),
  selectedConversation: undefined,
  selectedMessages: [],
  hasMoreOlderMessages: false,
  onLoadOlderMessages: vi.fn(),
  onAtEndChange: vi.fn(),
  selectedConversationUserOnline: false,
  searchQuery: '',
  onSearchChange: vi.fn(),
  conversationFilter: 'all' as const,
  onConversationFilterChange: vi.fn(),
  conversationSwipeHandlers: {} as any,
  existingConversationUserIds: [],
  userSearchDialogOpen: false,
  onUserSearchDialogOpenChange: vi.fn(),
  newConversationSearch: '',
  newConversationTargetUserId: undefined,
  memberListDialogOpen: false,
  onMemberListDialogOpenChange: vi.fn(),
  deleteDialogOpen: false,
  onDeleteDialogOpenChange: vi.fn(),
  isCancelRequest: false,
  onTogglePin: vi.fn(),
  onCreateConversationRequest: vi.fn(),
  onDeleteConversation: vi.fn(),
  onAcceptConversation: vi.fn(),
  onRejectConversation: vi.fn(),
  onSendMessage: vi.fn(),
  onNewConversationClick: vi.fn(),
  onNewAiConversationClick: vi.fn(),
  onDeleteConversationClick: vi.fn(),
  onRenameConversation: vi.fn(),
};

describe('MessagesPageView loading structure', () => {
  beforeEach(() => {
    captured.conversationListProps = undefined;
    captured.messageViewProps = undefined;
    captured.newConversationDialogProps = undefined;
  });

  it('keeps the split shell mounted while conversations load', () => {
    render(<MessagesPageView {...baseProps} isLoading isThreadLoading />);

    expect(screen.getByTestId('conversation-list')).toBeTruthy();
    expect(screen.getByTestId('message-view')).toBeTruthy();
    expect(captured.conversationListProps.isLoading).toBe(true);
    expect(captured.messageViewProps.isThreadLoading).toBe(true);
    expect(screen.queryByText('features.messages.loading')).toBeNull();
  });

  it('forwards the UUID target to the new conversation dialog', () => {
    render(
      <MessagesPageView
        {...baseProps}
        isLoading={false}
        newConversationTargetUserId="target-user-id"
      />
    );

    expect(captured.newConversationDialogProps.initialUserId).toBe('target-user-id');
  });
});
