import { FeedSplitLayout, FeedStatePanel } from '@/features/shared/ui/feed';
import type { ConversationFilter } from '../hooks/useConversationFilters';
import type { Conversation, Message } from '../types/message.types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ConversationList } from './ConversationList';
import { DeleteConversationDialog } from './DeleteConversationDialog';
import { GroupMembersDialog } from './GroupMembersDialog';
import { MessageView } from './MessageView';
import { NewConversationDialog } from './NewConversationDialog';

export interface MessagesPageViewProps {
  isLoading: boolean;
  currentUserId?: string;
  filteredConversations: Conversation[];
  conversationOnlineStatus: Readonly<Record<string, boolean>>;
  selectedConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  selectedConversation?: Conversation;
  selectedMessages: Message[];
  hasMoreOlderMessages: boolean;
  onLoadOlderMessages: () => void;
  onAtEndChange: (isAtEnd: boolean) => void;
  selectedConversationUserOnline: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  conversationFilter: ConversationFilter;
  onConversationFilterChange: (filter: ConversationFilter) => void;
  existingConversationUserIds: string[];
  userSearchDialogOpen: boolean;
  onUserSearchDialogOpenChange: (open: boolean) => void;
  newConversationSearch: string;
  memberListDialogOpen: boolean;
  onMemberListDialogOpenChange: (open: boolean) => void;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onCreateConversationRequest: (otherUserId: string) => Promise<void>;
  onDeleteConversation: () => Promise<void>;
  onAcceptConversation: (conversation: Conversation) => Promise<void>;
  onRejectConversation: (conversation: Conversation) => void;
  onSendMessage: (content: string, contextJson: string) => Promise<boolean>;
  onNewConversationClick: () => void;
  onNewAiConversationClick: () => Promise<void>;
  onDeleteConversationClick: (id: string) => void;
  onRenameConversation: (id: string, name: string | null) => Promise<boolean>;
}

export function MessagesPageView({
  isLoading,
  currentUserId,
  filteredConversations,
  conversationOnlineStatus,
  selectedConversationId,
  onSelectConversation,
  selectedConversation,
  selectedMessages,
  hasMoreOlderMessages,
  onLoadOlderMessages,
  onAtEndChange,
  selectedConversationUserOnline,
  searchQuery,
  onSearchChange,
  conversationFilter,
  onConversationFilterChange,
  existingConversationUserIds,
  userSearchDialogOpen,
  onUserSearchDialogOpenChange,
  newConversationSearch,
  memberListDialogOpen,
  onMemberListDialogOpenChange,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onTogglePin,
  onCreateConversationRequest,
  onDeleteConversation,
  onAcceptConversation,
  onRejectConversation,
  onSendMessage,
  onNewConversationClick,
  onNewAiConversationClick,
  onDeleteConversationClick,
  onRenameConversation,
}: MessagesPageViewProps) {
  const { t } = useTranslation();
  const messagesLayoutStyle = {
    height:
      'calc(100dvh - var(--app-shell-mobile-top-offset, 0rem) - var(--app-shell-mobile-bottom-offset, 0rem) - 3rem)',
  };

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <FeedStatePanel
          isLoading
          title={t('features.messages.loading')}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <>
      <FeedSplitLayout style={messagesLayoutStyle}>
        <ConversationList
          className="h-full"
          conversations={filteredConversations}
          conversationOnlineStatus={conversationOnlineStatus}
          selectedConversationId={selectedConversationId}
          onSelectConversation={onSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          conversationFilter={conversationFilter}
          onConversationFilterChange={onConversationFilterChange}
          currentUserId={currentUserId}
          onNewConversationClick={onNewConversationClick}
          onNewAiConversationClick={onNewAiConversationClick}
          onDeleteConversationClick={onDeleteConversationClick}
        />

        <MessageView
          className="h-full"
          conversation={selectedConversation}
          messages={selectedMessages}
          hasMoreOlderMessages={hasMoreOlderMessages}
          onLoadOlderMessages={onLoadOlderMessages}
          onAtEndChange={onAtEndChange}
          currentUserId={currentUserId}
          isConversationUserOnline={selectedConversationUserOnline}
          onBack={() => onSelectConversation(null)}
          onTogglePin={onTogglePin}
          onDeleteClick={onDeleteConversationClick}
          onMembersClick={() => onMemberListDialogOpenChange(true)}
          onRenameConversation={onRenameConversation}
          onSendMessage={onSendMessage}
          onAcceptConversation={onAcceptConversation}
          onRejectConversation={onRejectConversation}
        />
      </FeedSplitLayout>

      <NewConversationDialog
        open={userSearchDialogOpen}
        onOpenChange={onUserSearchDialogOpenChange}
        currentUserId={currentUserId}
        initialSearchQuery={newConversationSearch}
        onUserSelect={onCreateConversationRequest}
        existingConversationUserIds={existingConversationUserIds}
      />

      <GroupMembersDialog
        open={memberListDialogOpen}
        onOpenChange={onMemberListDialogOpenChange}
        conversation={selectedConversation}
      />

      <DeleteConversationDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onDeleteConversation}
      />
    </>
  );
}
