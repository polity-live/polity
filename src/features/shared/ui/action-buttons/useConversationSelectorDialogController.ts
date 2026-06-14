'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { useTranslation } from '@/features/shared/hooks/use-translation';

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
export function useConversationSelectorDialogController({
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
  return {
    open,
    onOpenChange,
    conversations,
    isLoading,
    onShareToConversation,
    shareUrl,
    shareTitle,
    shareDescription,
    shareContextItem,
    title,
    searchPlaceholder,
    emptyLabel,
    loadingLabel,
    t,
    searchQuery,
    setSearchQuery,
    sending,
    setSending,
    filteredConversations,
    handleShareToConversation,
  };
}
