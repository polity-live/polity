'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { MessageSquare, Search } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Input } from '@/features/shared/ui/ui/input';
import { useTranslation } from '@/features/shared/hooks/use-translation';
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

interface ConversationSelectorDialogProps extends ConversationSharePayload {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations?: readonly ConversationSelectorItem[];
  isLoading?: boolean;
  onShareToConversation?: (
    conversationId: string,
    payload: ConversationSharePayload
  ) => Promise<void> | void;
  title?: ReactNode;
  searchPlaceholder?: string;
  emptyLabel?: ReactNode;
  loadingLabel?: ReactNode;
}

export function ConversationSelectorDialog({
  open,
  onOpenChange,
  conversations = [],
  isLoading = false,
  onShareToConversation,
  shareUrl,
  shareTitle,
  shareDescription,
  shareContextItem,
  title,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
}: ConversationSelectorDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const sortedConversations = [...conversations].sort(
      (left, right) => (right.lastMessageAt ?? 0) - (left.lastMessageAt ?? 0)
    );

    if (!normalizedQuery) {
      return sortedConversations;
    }

    return sortedConversations.filter(conversation =>
      [conversation.name, conversation.handle]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [conversations, searchQuery]);

  const handleShareToConversation = async (conversationId: string) => {
    if (!onShareToConversation) {
      return;
    }

    setSending(conversationId);

    try {
      await onShareToConversation(conversationId, {
        shareUrl,
        shareTitle,
        shareDescription,
        shareContextItem,
      });
      onOpenChange(false);
      setSearchQuery('');
    } finally {
      setSending(null);
    }
  };

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
              <div className="text-muted-foreground py-8 text-center">
                {loadingLabel ?? t('common.loading.conversations')}
              </div>
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
              filteredConversations.map(conversation => {
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
