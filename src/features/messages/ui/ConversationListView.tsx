import { FormControlInput } from '@/features/shared/ui/form';
import type { CSSProperties } from 'react';
import { Card, CardHeader } from '@/features/shared/ui/ui/card';
import { Separator } from '@/features/shared/ui/ui/separator';
import { Button } from '@/features/shared/ui/ui/button';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { Search, MessageCircle, Bot } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { ConversationItem } from './ConversationItem';
import { rowAttributes } from '@/features/shared/virtualization';

export interface ConversationListViewProps {
  className: any;
  conversationFilter: any;
  conversationOnlineStatus: any;
  conversations: any;
  currentUserId: any;
  filterButtons: any;
  isLoading?: boolean;
  onConversationFilterChange: any;
  onDeleteConversationClick: any;
  onNewAiConversationClick: any;
  onNewConversationClick: any;
  onSearchChange: any;
  onSelectConversation: any;
  virtualItems: readonly any[];
  spaceBefore: number;
  spaceAfter: number;
  rowsEmpty: boolean;
  scrollRef: any;
  searchQuery: any;
  selectedConversationId: any;
  t: any;
}

export function ConversationListView({
  className,
  conversationFilter,
  conversationOnlineStatus,
  conversations,
  currentUserId,
  filterButtons,
  isLoading = false,
  onConversationFilterChange,
  onDeleteConversationClick,
  onNewAiConversationClick,
  onNewConversationClick,
  onSearchChange,
  onSelectConversation,
  virtualItems = [],
  spaceBefore = 0,
  spaceAfter = 0,
  rowsEmpty = conversations.length === 0,
  scrollRef,
  searchQuery,
  selectedConversationId,
  t,
}: ConversationListViewProps) {
  const showSkeletons = isLoading && virtualItems.length === 0;

  return (
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden md:col-span-1',
        selectedConversationId && 'hidden md:flex',
        className
      )}
    >
      <CardHeader className="flex-shrink-0 space-y-4">
        <h1 className="sr-only">{t('features.messages.title')}</h1>
        <div className="space-y-2">
          <div data-slot="conversation-search-row" className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <FormControlInput
                placeholder={t('features.messages.searchConversations')}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={onNewConversationClick}
                aria-label={t('features.messages.compose.startNewChat')}
                title={t('features.messages.compose.startNewChat')}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="default"
                onClick={onNewAiConversationClick}
                aria-label={t('features.messages.compose.startNewAi')}
                title={t('features.messages.compose.startNewAi')}
              >
                <Bot className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((filter: any) => (
              <Button
                key={filter}
                type="button"
                size="sm"
                variant={conversationFilter === filter ? 'default' : 'outline'}
                className="civic-motion-selectable"
                onClick={() => onConversationFilterChange(filter)}
              >
                {t(`features.messages.filters.${filter}`)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <Separator />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          {showSkeletons ? (
            <div className="space-y-3" data-slot="conversation-list-skeleton">
              {Array.from({ length: 7 }, (_, index) => (
                <div
                  key={index}
                  className="civic-stagger-item flex items-center gap-3 rounded-lg border border-transparent p-3"
                  style={{ '--civic-stagger-index': index } as CSSProperties}
                >
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              ))}
              <p className="animate-loading-fade-in text-muted-foreground px-3 text-center text-xs opacity-0 [animation-delay:800ms]">
                {t('features.messages.syncingConversations', 'Conversations are syncing')}
              </p>
            </div>
          ) : rowsEmpty ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery || conversationFilter !== 'all'
                  ? t('features.messages.noConversationsFound')
                  : t('features.messages.noConversations')}
              </p>
            </div>
          ) : (
            <div style={{ paddingTop: spaceBefore, paddingBottom: spaceAfter }}>
              {virtualItems.map((virtualItem: any) => {
                const conversation = virtualItem.row;
                return (
                  <div key={virtualItem.key} {...rowAttributes(virtualItem.index, virtualItem.key)}>
                    {conversation ? (
                      <ConversationItem
                        conversation={conversation}
                        currentUserId={currentUserId}
                        isOnline={conversationOnlineStatus[conversation.id] ?? false}
                        isSelected={selectedConversationId === conversation.id}
                        onSelect={onSelectConversation}
                        onDelete={onDeleteConversationClick}
                      />
                    ) : (
                      <div className="flex items-center gap-3 p-3" aria-hidden="true">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-5/6" />
                        </div>
                      </div>
                    )}
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
