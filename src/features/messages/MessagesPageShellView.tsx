'use client';

import { PageWrapper } from '@/layout/page-wrapper';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { MessagesPageView as MessagesPageContentView } from './ui/MessagesPageView';
import type { useMessagesPage } from './hooks/useMessagesPage';

type MessagesPageModel = ReturnType<typeof useMessagesPage>;

export interface MessagesPageShellViewProps {
  mp: MessagesPageModel;
}

export function MessagesPageShellView({ mp }: MessagesPageShellViewProps) {
  return (
    <AuthGuard requireAuth={true}>
      <PageWrapper>
        <MessagesPageContentView
          isLoading={mp.isLoading}
          currentUserId={mp.currentUserId}
          filteredConversations={mp.filteredConversations}
          conversationOnlineStatus={mp.conversationOnlineStatus}
          selectedConversationId={mp.selectedConversationId}
          onSelectConversation={mp.setSelectedConversationId}
          selectedConversation={mp.selectedConversation}
          selectedMessages={mp.selectedMessages}
          isThreadLoading={mp.isSelectedMessagesLoading}
          hasMoreOlderMessages={mp.hasMoreOlderMessages}
          onLoadOlderMessages={mp.loadOlderMessages}
          onAtEndChange={mp.setIsSelectedConversationAtEnd}
          selectedConversationUserOnline={mp.selectedConversationUserOnline}
          searchQuery={mp.searchQuery}
          onSearchChange={mp.setSearchQuery}
          conversationFilter={mp.conversationFilter}
          onConversationFilterChange={mp.setConversationFilter}
          conversationSwipeHandlers={mp.conversationSwipeHandlers}
          existingConversationUserIds={mp.existingConversationUserIds}
          userSearchDialogOpen={mp.userSearchDialogOpen}
          onUserSearchDialogOpenChange={mp.setUserSearchDialogOpen}
          newConversationSearch={mp.newConversationSearch}
          memberListDialogOpen={mp.memberListDialogOpen}
          onMemberListDialogOpenChange={mp.setMemberListDialogOpen}
          deleteDialogOpen={mp.deleteDialogOpen}
          onDeleteDialogOpenChange={mp.setDeleteDialogOpen}
          onTogglePin={mp.togglePin}
          onCreateConversationRequest={mp.handleCreateConversationRequest}
          onDeleteConversation={mp.handleDeleteConversation}
          onAcceptConversation={mp.handleAcceptConversation}
          onRejectConversation={mp.handleRejectConversation}
          onSendMessage={mp.handleSendMessage}
          onNewConversationClick={mp.openNewConversationDialog}
          onNewAiConversationClick={mp.handleCreateAssistantConversation}
          onDeleteConversationClick={mp.openDeleteDialog}
          onRenameConversation={mp.handleRenameConversation}
        />
      </PageWrapper>
    </AuthGuard>
  );
}
