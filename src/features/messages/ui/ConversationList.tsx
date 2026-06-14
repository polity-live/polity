import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Card, CardHeader } from '@/features/shared/ui/ui/card';
import { Separator } from '@/features/shared/ui/ui/separator';
import { Input } from '@/features/shared/ui/ui/input';
import { Button } from '@/features/shared/ui/ui/button';
import { Search, MessageCircle, Bot } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { SEARCH_CARD_GRADIENTS } from '@/features/shared/utils/search-card-gradients';
import { Conversation } from '../types/message.types';
import { ConversationItem } from './ConversationItem';
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
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden md:col-span-1',
        selectedConversationId && 'hidden md:flex',
        className
      )}
    >
      <CardHeader className="flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('features.messages.title')}</h2>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              onClick={onNewConversationClick}
              aria-label={t('features.messages.compose.startNewChat')}
              title={t('features.messages.compose.startNewChat')}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="default"
              className="rounded-full"
              onClick={onNewAiConversationClick}
              aria-label={t('features.messages.compose.startNewAi')}
              title={t('features.messages.compose.startNewAi')}
            >
              <Bot className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={t('features.messages.searchConversations')}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map(filter =>
              (() => {
                const gradient = filterGradients[filter];

                return (
                  <Button
                    key={filter}
                    type="button"
                    size="sm"
                    variant={
                      gradient ? 'outline' : conversationFilter === filter ? 'default' : 'outline'
                    }
                    className={cn(
                      gradient && gradient,
                      gradient && 'text-foreground hover:text-foreground border-transparent',
                      gradient &&
                        (conversationFilter === filter
                          ? 'opacity-100 shadow-sm ring-1 ring-black/10 dark:ring-white/15'
                          : 'opacity-70 hover:opacity-100')
                    )}
                    onClick={() => onConversationFilterChange(filter)}
                  >
                    {t(`features.messages.filters.${filter}`)}
                  </Button>
                );
              })()
            )}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery || conversationFilter !== 'all'
                  ? t('features.messages.noConversationsFound')
                  : t('features.messages.noConversations')}
              </p>
            </div>
          ) : (
            <div
              className="relative"
              style={{
                height: rowVirtualizer.getTotalSize(),
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualItem => {
                const conversation = conversations[virtualItem.index];
                if (!conversation) return null;

                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full pb-1"
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <ConversationItem
                      conversation={conversation}
                      currentUserId={currentUserId}
                      isOnline={conversationOnlineStatus[conversation.id] ?? false}
                      isSelected={selectedConversationId === conversation.id}
                      onSelect={onSelectConversation}
                      onDelete={onDeleteConversationClick}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
