'use client';
import { MessageSquare, Search } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { SectionSkeleton } from '@/features/shared/ui/feedback';
import { Input } from '@/features/shared/ui/ui/input';
import { cn } from '@/features/shared/utils/utils';

export interface ConversationSelectorItem {
  id: string;
  name: string;
  avatar?: string | null;
  handle?: string | null;
  isGroup?: boolean;
  participantCount?: number;
  status?: 'active' | 'pending' | string | null;
  lastMessageAt?: number | null;
}

export interface ConversationSharePayload {
  shareUrl: string;
  shareTitle: string;
  shareDescription?: string;
  shareContextItem?: unknown;
}
export interface ConversationSelectorDialogViewProps {
  open: any;
  onOpenChange: any;
  conversations: readonly any[];
  isLoading: any;
  onShareToConversation: any;
  shareUrl: any;
  shareTitle: any;
  shareDescription: any;
  shareContextItem: any;
  title: any;
  searchPlaceholder: any;
  emptyLabel: any;
  loadingLabel: any;
  t: any;
  searchQuery: any;
  setSearchQuery: any;
  sending: any;
  setSending: any;
  filteredConversations: readonly any[];
  handleShareToConversation: any;
}

export function ConversationSelectorDialogView({
  open,
  onOpenChange,
  isLoading,
  onShareToConversation,
  title,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  t,
  searchQuery,
  setSearchQuery,
  sending,
  filteredConversations,
  handleShareToConversation,
}: ConversationSelectorDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title ?? t('common.share.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder ?? t('common.share.searchConversations')}
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {isLoading ? (
              <SectionSkeleton
                rows={4}
                density="compact"
                label={loadingLabel ?? t('common.loading.conversations')}
              />
            ) : filteredConversations.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                <p className="text-muted-foreground">
                  {emptyLabel ??
                    (searchQuery
                      ? t('common.share.noConversationsFound')
                      : t('common.share.noConversationsYet'))}
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation: any) => {
                const isSending = sending === conversation.id;
                const isPending = conversation.status === 'pending';

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => handleShareToConversation(conversation.id)}
                    disabled={isSending || isPending || !onShareToConversation}
                    className={cn(
                      'hover:bg-accent flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
                      isSending && 'opacity-50'
                    )}
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={conversation.avatar ?? undefined} />
                      <AvatarFallback>
                        {conversation.name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{conversation.name}</p>
                        {conversation.isGroup && conversation.participantCount !== undefined ? (
                          <Badge variant="secondary" className="text-xs">
                            {conversation.participantCount}
                          </Badge>
                        ) : null}
                        {isPending ? (
                          <Badge variant="outline" className="text-xs">
                            {t('common.labels.pending')}
                          </Badge>
                        ) : null}
                      </div>
                      {conversation.handle ? (
                        <p className="text-muted-foreground truncate text-sm">
                          @{conversation.handle}
                        </p>
                      ) : null}
                    </div>
                    {isSending ? (
                      <div className="text-muted-foreground text-xs">
                        {t('common.labels.sending')}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
