'use client';

import { PageWrapper } from '@/layout/page-wrapper';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { useMessagesPage } from './hooks/useMessagesPage';
import { ConversationList } from './ui/ConversationList';
import { MessageView } from './ui/MessageView';
import { NewConversationDialog } from './ui/NewConversationDialog';
import { GroupMembersDialog } from './ui/GroupMembersDialog';
import { DeleteConversationDialog } from './ui/DeleteConversationDialog';

export default function MessagesPage() {
  const mp = useMessagesPage();
  const messagesLayoutStyle = {
    height:
      'calc(100dvh - var(--app-shell-mobile-top-offset, 0rem) - var(--app-shell-mobile-bottom-offset, 0rem) - 3rem)',
  };

  if (mp.isLoading) {
    return (
      <AuthGuard requireAuth={true}>
        <PageWrapper>
          <div className="flex h-[600px] items-center justify-center">
            <p className="text-muted-foreground">{mp.t('features.messages.loading')}</p>
          </div>
        </PageWrapper>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAuth={true}>
      <PageWrapper>
        <div
          style={messagesLayoutStyle}
          className="flex min-h-0 flex-col gap-4 md:grid md:grid-cols-3 md:[grid-template-rows:minmax(0,1fr)]"
        >
          <ConversationList
            className="h-full"
            conversations={mp.filteredConversations}
            conversationOnlineStatus={mp.conversationOnlineStatus}
            selectedConversationId={mp.selectedConversationId}
            onSelectConversation={mp.setSelectedConversationId}
            searchQuery={mp.searchQuery}
            onSearchChange={mp.setSearchQuery}
            conversationFilter={mp.conversationFilter}
            onConversationFilterChange={mp.setConversationFilter}
            currentUserId={mp.currentUserId}
            onNewConversationClick={mp.openNewConversationDialog}
            onNewAiConversationClick={mp.handleCreateAssistantConversation}
            onDeleteConversationClick={mp.openDeleteDialog}
          />

          <MessageView
            className="h-full"
            conversation={mp.selectedConversation}
            currentUserId={mp.currentUserId}
            isConversationUserOnline={mp.selectedConversationUserOnline}
            onBack={() => mp.setSelectedConversationId(null)}
            onTogglePin={mp.togglePin}
            onDeleteClick={mp.openDeleteDialog}
            onMembersClick={() => mp.setMemberListDialogOpen(true)}
            onRenameConversation={mp.handleRenameConversation}
            onSendMessage={mp.handleSendMessage}
            onAcceptConversation={mp.handleAcceptConversation}
            onRejectConversation={mp.handleRejectConversation}
          />
        </div>

        <NewConversationDialog
          open={mp.userSearchDialogOpen}
          onOpenChange={mp.setUserSearchDialogOpen}
          currentUserId={mp.currentUserId}
          initialSearchQuery={mp.newConversationSearch}
          onUserSelect={mp.handleCreateConversationRequest}
          existingConversationUserIds={mp.existingConversationUserIds}
        />

        <GroupMembersDialog
          open={mp.memberListDialogOpen}
          onOpenChange={mp.setMemberListDialogOpen}
          conversation={mp.selectedConversation}
        />

        <DeleteConversationDialog
          open={mp.deleteDialogOpen}
          onOpenChange={mp.setDeleteDialogOpen}
          onConfirm={mp.handleDeleteConversation}
        />
      </PageWrapper>
    </AuthGuard>
  );
}
