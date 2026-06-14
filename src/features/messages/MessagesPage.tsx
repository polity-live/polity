'use client';

import { PageWrapper } from '@/layout/page-wrapper';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { useMessagesPage } from './hooks/useMessagesPage';
import { MessagesPageView } from './ui/MessagesPageView';

export default function MessagesPage() {
  const mp = useMessagesPage();

  return (
    <AuthGuard requireAuth={true}>
      <PageWrapper>
        <MessagesPageView
          isLoading={mp.isLoading}
          currentUserId={mp.currentUserId}
          filteredConversations={mp.filteredConversations}
          conversationOnlineStatus={mp.conversationOnlineStatus}
          selectedConversationId={mp.selectedConversationId}
          onSelectConversation={mp.setSelectedConversationId}
          selectedConversation={mp.selectedConversation}
          selectedMessages={mp.selectedMessages}
          hasMoreOlderMessages={mp.hasMoreOlderMessages}
          onLoadOlderMessages={mp.loadOlderMessages}
          onAtEndChange={mp.setIsSelectedConversationAtEnd}
          selectedConversationUserOnline={mp.selectedConversationUserOnline}
          searchQuery={mp.searchQuery}
          onSearchChange={mp.setSearchQuery}
          conversationFilter={mp.conversationFilter}
          onConversationFilterChange={mp.setConversationFilter}
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
