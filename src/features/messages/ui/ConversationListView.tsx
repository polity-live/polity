import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlInput } from '@/features/shared/ui/form';
import { Card, CardHeader } from '@/features/shared/ui/ui/card';
import { Separator } from '@/features/shared/ui/ui/separator';
import { Button } from '@/features/shared/ui/ui/button';
import { Search, MessageCircle, Bot } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { ConversationItem } from './ConversationItem';
export interface ConversationListViewProps {
  className: any;
  conversationFilter: any;
  conversationOnlineStatus: any;
  conversations: any;
  currentUserId: any;
  filterButtons: any;
  filterGradients: any;
  onConversationFilterChange: any;
  onDeleteConversationClick: any;
  onNewAiConversationClick: any;
  onNewConversationClick: any;
  onSearchChange: any;
  onSelectConversation: any;
  rowVirtualizer: any;
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
  filterGradients,
  onConversationFilterChange,
  onDeleteConversationClick,
  onNewAiConversationClick,
  onNewConversationClick,
  onSearchChange,
  onSelectConversation,
  rowVirtualizer,
  scrollRef,
  searchQuery,
  selectedConversationId,
  t,
}: ConversationListViewProps) {
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
            <FormControlInput
              placeholder={t('features.messages.searchConversations')}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((filter: any) =>
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
                          ? featureThemeClassName('messageConversationListContrastRing')
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
              {rowVirtualizer.getVirtualItems().map((virtualItem: any) => {
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
