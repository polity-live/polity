import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { SEARCH_CARD_GRADIENTS } from '@/features/shared/utils/search-card-gradients';
import { Conversation } from '../types/message.types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { ConversationFilter } from '../hooks/useConversationFilters';

interface ConversationListProps {
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
  const filterGradients: Partial<Record<ConversationFilter, string>> = {
    direct: SEARCH_CARD_GRADIENTS.user,
    group: SEARCH_CARD_GRADIENTS.group,
    event: SEARCH_CARD_GRADIENTS.event,
  };
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
      filterGradients={filterGradients}
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
