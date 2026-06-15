import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Conversation } from '../types/message.types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ConversationFilter } from '../hooks/useConversationFilters';

interface ConversationListProps {
  isLoading?: boolean;
  conversations: Conversation[];
  conversationOnlineStatus: Readonly<Record<string, boolean>>;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  conversationFilter: ConversationFilter;
  onConversationFilterChange: (filter: ConversationFilter) => void;
  currentUserId?: string;
  onNewConversationClick: () => void;
  onNewAiConversationClick: () => void;
  onDeleteConversationClick: (id: string) => void;
  className?: string;
}
import { ConversationListView } from './ConversationListView';
export function ConversationList({
  isLoading = false,
  conversations,
  conversationOnlineStatus,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  conversationFilter,
  onConversationFilterChange,
  currentUserId,
  onNewConversationClick,
  onNewAiConversationClick,
  onDeleteConversationClick,
  className,
}: ConversationListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const filterButtons: ConversationFilter[] = ['all', 'direct', 'group', 'event', 'ai'];
  const rowVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 8,
    getItemKey: index => conversations[index]?.id ?? index,
  });
  return (
    <ConversationListView
      className={className}
      conversationFilter={conversationFilter}
      conversationOnlineStatus={conversationOnlineStatus}
      conversations={conversations}
      currentUserId={currentUserId}
      filterButtons={filterButtons}
      isLoading={isLoading}
      onConversationFilterChange={onConversationFilterChange}
      onDeleteConversationClick={onDeleteConversationClick}
      onNewAiConversationClick={onNewAiConversationClick}
      onNewConversationClick={onNewConversationClick}
      onSearchChange={onSearchChange}
      onSelectConversation={onSelectConversation}
      rowVirtualizer={rowVirtualizer}
      scrollRef={scrollRef}
      searchQuery={searchQuery}
      selectedConversationId={selectedConversationId}
      t={t}
    />
  );
}
