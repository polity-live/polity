/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pageView: vi.fn(() => null) }));
const model = vi.hoisted(() => ({
  isLoading: false,
  currentUserId: 'user-1',
  filteredConversations: [],
  conversationOnlineStatus: {},
  selectedConversationId: null,
  setSelectedConversationId: vi.fn(),
  selectedConversation: null,
  selectedMessages: [],
  isSelectedMessagesLoading: false,
  hasMoreOlderMessages: false,
  loadOlderMessages: vi.fn(),
  setIsSelectedConversationAtEnd: vi.fn(),
  selectedConversationUserOnline: false,
  searchQuery: '',
  setSearchQuery: vi.fn(),
  conversationFilter: 'all',
  setConversationFilter: vi.fn(),
  conversationSwipeHandlers: {},
  existingConversationUserIds: [],
  userSearchDialogOpen: false,
  setUserSearchDialogOpen: vi.fn(),
  newConversationSearch: '',
  newConversationTargetUserId: null,
  memberListDialogOpen: false,
  setMemberListDialogOpen: vi.fn(),
  deleteDialogOpen: false,
  setDeleteDialogOpen: vi.fn(),
  isCancelRequest: false,
  togglePin: vi.fn(),
  handleCreateConversationRequest: vi.fn(),
  handleDeleteConversation: vi.fn(),
  handleAcceptConversation: vi.fn(),
  handleRejectConversation: vi.fn(),
  handleSendMessage: vi.fn(),
  openNewConversationDialog: vi.fn(),
  handleCreateAssistantConversation: vi.fn(),
  openDeleteDialog: vi.fn(),
  handleRenameConversation: vi.fn(),
}));

vi.mock('../hooks/useMessagesPage', () => ({ useMessagesPage: () => model }));
vi.mock('@/features/auth/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/layout/page-wrapper', () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../ui/MessagesPageView', () => ({ MessagesPageView: mocks.pageView }));

import MessagesPage from '../MessagesPage';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('messages page LSF composition', () => {
  it('connects the page model through its authenticated shell', () => {
    render(<MessagesPage />);
    expect(mocks.pageView).toHaveBeenCalledWith(
      expect.objectContaining({
        currentUserId: 'user-1',
        onSelectConversation: model.setSelectedConversationId,
        onSendMessage: model.handleSendMessage,
      }),
      undefined
    );
  });
});
