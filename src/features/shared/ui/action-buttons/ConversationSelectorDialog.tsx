'use client';

import { type ReactNode } from 'react';

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
import { useConversationSelectorDialogController } from './useConversationSelectorDialogController';
import { ConversationSelectorDialogView } from './ConversationSelectorDialogView';

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
  const viewProps = useConversationSelectorDialogController({
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
  });

  return <ConversationSelectorDialogView {...viewProps} />;
}
