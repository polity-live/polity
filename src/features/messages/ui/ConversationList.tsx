import { useCallback, useMemo, useRef } from 'react';
import { Conversation } from '../types/message.types';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { usePolityZeroList } from '@/features/shared/virtualization';
import type { ConversationFilter } from '../hooks/useConversationFilters';
import { queries } from '@/zero/queries';

interface ConversationStart {
  pinned?: boolean | null;
  last_message_at?: number | null;
  id: string;
}

function toConversationStart(conversation: Conversation): ConversationStart {
  return {
    pinned: conversation.pinned,
    last_message_at: conversation.last_message_at,
    id: conversation.id,
  };
}

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
  const listContextParams = useMemo(
    () => ({ filter: conversationFilter, query: searchQuery.trim() }),
    [conversationFilter, searchQuery]
  );
  const getPageQuery = useCallback(
    ({ limit, start, dir, settled }: any) => ({
      query: queries.messages.conversationPage({
        filter: conversationFilter,
        query: searchQuery.trim(),
        limit,
        start,
        dir,
      }) as any,
      options: { ttl: settled ? ('5m' as const) : ('none' as const) },
    }),
    [conversationFilter, searchQuery]
  );
  const getSingleQuery = useCallback(
    ({ id, settled }: any) => ({
      query: queries.messages.conversationById({ id }) as any,
      options: { ttl: settled ? ('5m' as const) : ('none' as const) },
    }),
    []
  );
  const virtualList = usePolityZeroList<typeof listContextParams, Conversation, ConversationStart>({
    scrollStateKey: 'messages-conversations',
    listContextParams,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => 92, []),
    overscan: 8,
    getPageQuery,
    getSingleQuery,
    getRowKey: conversation => conversation.id,
    toStartRow: toConversationStart,
    permalinkID: selectedConversationId ?? undefined,
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
      virtualItems={virtualList.items}
      spaceBefore={virtualList.spaceBefore}
      spaceAfter={virtualList.spaceAfter}
      rowsEmpty={virtualList.rowsEmpty}
      scrollRef={scrollRef}
      searchQuery={searchQuery}
      selectedConversationId={selectedConversationId}
      t={t}
    />
  );
}
