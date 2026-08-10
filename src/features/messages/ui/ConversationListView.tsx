import { FormControlInput } from '@/features/shared/ui/form';
import type { CSSProperties } from 'react';
import { Card, CardHeader } from '@/features/shared/ui/ui/card';
import { Separator } from '@/features/shared/ui/ui/separator';
import { Button } from '@/features/shared/ui/ui/button';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { Search, MessageCircle, Bot } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { ConversationItem } from './ConversationItem';
import { rowAttributes, ZeroVirtualSpacer } from '@/features/shared/virtualization';

export interface ConversationListViewProps {
  className: any;
  conversationFilter: any;
  conversationOnlineStatus: any;
  conversations: any;
  currentUserId: any;
  filterButtons: any;
  isMobileScreen?: boolean;
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
  isMobileScreen = false,
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
  const isConcealedMobileList = isMobileScreen && Boolean(selectedConversationId);

  return (
    <Card
      aria-hidden={isConcealedMobileList || undefined}
      inert={isConcealedMobileList}
      className={cn(
        'md:bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none md:col-span-1 md:rounded-lg md:border md:shadow-[var(--shadow-panel)]',
        isConcealedMobileList && 'pointer-events-none invisible absolute inset-0',
        className
      )}
    >
      <CardHeader className="flex-shrink-0 space-y-4 px-0 md:px-6">
        <h1 className="sr-only">{t('features.messages.title')}</h1>
        <div className="space-y-2">
          <div data-slot="conversation-search-row" className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <FormControlInput
                data-action-id="messages.conversation.search.change"
                placeholder={t('features.messages.searchConversations')}
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                data-action-id="messages.conversation.create.open"
                size="icon"
                variant="outline"
                onClick={onNewConversationClick}
                aria-label={t('features.messages.compose.startNewChat')}
                title={t('features.messages.compose.startNewChat')}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <Button
                data-action-id="messages.ai-conversation.create"
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
                data-action-id="messages.conversation.filter.select"
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
        <div className="py-4 md:p-4">
          {showSkeletons ? (
            <div className="space-y-3" data-slot="conversation-list-skeleton">
              {Array.from({ length: 7 }, (_, index) => (
                <div
                  key={index}
                  className="civic-stagger-item flex items-center gap-3 rounded-lg border border-transparent px-0 py-3 md:p-3"
                  style={{ '--civic-stagger-index': index } as CSSProperties}
                >
                  <Skeleton className="h-12 w-12 rounded-md" />
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
            <div>
              <ZeroVirtualSpacer position="before" size={spaceBefore} />
              {virtualItems.map((virtualItem: any, itemPosition: number) => {
                const conversation = virtualItem.row;
                return (
                  <div
                    key={virtualItem.key}
                    {...rowAttributes(virtualItem.index, virtualItem.key)}
                    style={itemPosition === 0 ? { marginTop: 0 } : undefined}
                  >
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
                      <div className="flex items-center gap-3 px-0 py-3 md:p-3" aria-hidden="true">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-5/6" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <ZeroVirtualSpacer position="after" size={spaceAfter} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
