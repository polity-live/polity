import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useOnlineUsers } from '@/presence';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { useMessageState } from '@/zero/messages/useMessageState';
import { useConversationData } from './useConversationData';
import { useMessageMutations } from './useMessageMutations';
import { useConversationFilters } from './useConversationFilters';
import { useConversationSelection } from './useConversationSelection';
import { useNewAiConversationIntent } from './useNewAiConversationIntent';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Conversation } from '../types/message.types';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';
import { useSwipeNavigation } from '@/features/shared/hooks/useSwipeNavigation';
import { isConversationRequester } from '../logic/messageUtils';

export function useMessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineUserIds } = useOnlineUsers();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;

  // Dialog state
  const [userSearchDialogOpen, setUserSearchDialogOpen] = useState(false);
  const [newConversationSearch, setNewConversationSearch] = useState('');
  const [newConversationTargetUserId, setNewConversationTargetUserId] = useState<
    string | undefined
  >();
  const [memberListDialogOpen, setMemberListDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [messageLimit, setMessageLimit] = useState(80);
  const [isSelectedConversationAtEnd, setIsSelectedConversationAtEnd] = useState(true);

  // Current user name for notifications
  const { currentUser: currentUserData } = useUserState();
  const currentUserName =
    `${currentUserData?.first_name ?? ''} ${currentUserData?.last_name ?? ''}`.trim() ||
    t('features.messages.fallbacks.someone');

  // Data hooks
  const { conversations, isLoading } = useConversationData(user?.id);
  const mutations = useMessageMutations();
  const {
    searchQuery,
    setSearchQuery,
    conversationFilter,
    setConversationFilter,
    filteredConversations,
  } = useConversationFilters(conversations, user?.id);
  const shouldOpenAriaKai = searchParams.openAriaKai === 'true';
  const { selectedConversationId, setSelectedConversationId, selectedConversation } =
    useConversationSelection(conversations, {
      openAriaKai: shouldOpenAriaKai,
    });
  const { messages: selectedMessages, isLoading: isSelectedMessagesLoading } = useMessageState({
    conversationId: selectedConversationId ?? undefined,
    messageLimit,
  });

  const conversationOnlineStatus = useMemo<Record<string, boolean>>(() => {
    const statusByConversationId: Record<string, boolean> = {};

    for (const conversation of conversations) {
      if (
        conversation.type === 'group' ||
        conversation.type === 'event' ||
        conversation.status !== 'accepted'
      ) {
        statusByConversationId[conversation.id] = false;
        continue;
      }

      const otherParticipantId = conversation.participants.find(
        participant => participant.user?.id !== user?.id
      )?.user?.id;

      statusByConversationId[conversation.id] = Boolean(
        otherParticipantId && onlineUserIds.has(otherParticipantId)
      );
    }

    return statusByConversationId;
  }, [conversations, onlineUserIds, user?.id]);

  const selectedConversationUserOnline = selectedConversation
    ? (conversationOnlineStatus[selectedConversation.id] ?? false)
    : false;
  const selectedConversationIndex = useMemo(
    () =>
      filteredConversations.findIndex(conversation => conversation.id === selectedConversationId),
    [filteredConversations, selectedConversationId]
  );

  const selectConversationAtOffset = useCallback(
    (offset: number) => {
      const targetConversation = filteredConversations[selectedConversationIndex + offset];
      if (targetConversation) {
        setSelectedConversationId(targetConversation.id);
      }
    },
    [filteredConversations, selectedConversationIndex, setSelectedConversationId]
  );

  const { handlers: conversationSwipeHandlers } = useSwipeNavigation({
    enabled: Boolean(selectedConversationId),
    disabled: userSearchDialogOpen || memberListDialogOpen || deleteDialogOpen,
    canSwipePrev: selectedConversationIndex > 0,
    canSwipeNext:
      selectedConversationIndex >= 0 &&
      selectedConversationIndex < filteredConversations.length - 1,
    onSwipePrev: () => selectConversationAtOffset(-1),
    onSwipeNext: () => selectConversationAtOffset(1),
    keyboardMode: 'global',
  });

  // Existing direct conversation user IDs (for new conversation dialog)
  const existingConversationUserIds = useMemo(() => {
    return conversations
      .filter(conv => conv.type === 'direct' && !isAssistantConversation(conv))
      .flatMap(conv => conv.participants.map(p => p.user?.id))
      .filter((id): id is string => id !== undefined && id !== user?.id);
  }, [conversations, user?.id]);

  const messageConversationId = searchParams.conversationId;
  const messageUserId = searchParams.userId;

  const clearComposeIntentFromUrl = useCallback(() => {
    const {
      conversationId,
      userId,
      name,
      new: newConversation,
      search,
      userSearch,
      ...remainingSearch
    } = searchParams;

    if (
      conversationId === undefined &&
      userId === undefined &&
      name === undefined &&
      newConversation === undefined &&
      search === undefined &&
      userSearch === undefined
    ) {
      return;
    }

    navigate({
      to: '/messages',
      search: remainingSearch,
      replace: true,
    });
  }, [navigate, searchParams]);

  const handleUserSearchDialogOpenChange = useCallback(
    (open: boolean) => {
      setUserSearchDialogOpen(open);

      if (!open) {
        setNewConversationSearch('');
        setNewConversationTargetUserId(undefined);
        clearComposeIntentFromUrl();
      }
    },
    [clearComposeIntentFromUrl]
  );

  // Open new conversation dialog from query params
  useEffect(() => {
    const shouldOpen = searchParams.new === '1';
    const search = searchParams.userSearch || searchParams.search;
    if (shouldOpen) {
      setUserSearchDialogOpen(true);
      setNewConversationSearch(search ?? '');
      setNewConversationTargetUserId(undefined);
      clearComposeIntentFromUrl();
    }
  }, [searchParams, clearComposeIntentFromUrl]);

  // Open a specific conversation from query params.
  useEffect(() => {
    if (!messageConversationId || isLoading) return;

    const existingConversation = conversations.find(conv => conv.id === messageConversationId);
    if (!existingConversation) return;

    setSelectedConversationId(existingConversation.id);
    setSearchQuery('');
    setUserSearchDialogOpen(false);
    setNewConversationSearch('');
    setNewConversationTargetUserId(undefined);
    clearComposeIntentFromUrl();
  }, [
    messageConversationId,
    conversations,
    isLoading,
    clearComposeIntentFromUrl,
    setSearchQuery,
    setSelectedConversationId,
  ]);

  // Route message intent based on existing conversations
  useEffect(() => {
    if (messageConversationId) return;
    if (!messageUserId || isLoading) return;

    const existingConversation = conversations.find(conv => {
      if (conv.type !== 'direct' || isAssistantConversation(conv)) return false;
      return conv.participants.some(p => p.user?.id === messageUserId);
    });

    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      setSearchQuery('');
      setUserSearchDialogOpen(false);
      setNewConversationSearch('');
      setNewConversationTargetUserId(undefined);
      clearComposeIntentFromUrl();
      return;
    }

    setUserSearchDialogOpen(true);
    setNewConversationSearch('');
    setNewConversationTargetUserId(messageUserId);
    clearComposeIntentFromUrl();
  }, [
    messageConversationId,
    messageUserId,
    conversations,
    isLoading,
    clearComposeIntentFromUrl,
    setSearchQuery,
    setSelectedConversationId,
  ]);

  useEffect(() => {
    setMessageLimit(80);
    setIsSelectedConversationAtEnd(true);
  }, [selectedConversationId]);

  // Mark messages as read when viewing a conversation at the end of the thread.
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;
    if (!isSelectedConversationAtEnd) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    void mutations.markConversationAsRead(selectedConversation, user.id);
  }, [isSelectedConversationAtEnd, selectedConversation?.id, selectedMessages, user?.id]);

  // Handlers
  const handleCreateConversationRequest = async (otherUserId: string) => {
    if (!user?.id) return;

    const existingConversation = conversations.find(conv => {
      if (conv.type !== 'direct' || isAssistantConversation(conv)) return false;
      const participantIds = conv.participants.map(p => p.user?.id);
      return (
        participantIds.length === 2 &&
        participantIds.includes(user.id) &&
        participantIds.includes(otherUserId)
      );
    });

    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      setUserSearchDialogOpen(false);
      setNewConversationTargetUserId(undefined);
      clearComposeIntentFromUrl();
      return;
    }

    const result = await mutations.createConversation(
      'direct',
      [user.id, otherUserId],
      undefined,
      user.id
    );
    if (result.success && result.conversationId) {
      setSelectedConversationId(result.conversationId);
      setUserSearchDialogOpen(false);
      setNewConversationTargetUserId(undefined);
      clearComposeIntentFromUrl();
    }
  };

  const handleCreateAssistantConversation = async () => {
    if (!user?.id) return;

    const result = await mutations.createAssistantConversation(
      user.id,
      t('features.messages.ai.defaultConversationName')
    );

    if (result.success && result.conversationId) {
      setSelectedConversationId(result.conversationId);
      setSearchQuery('');
      setConversationFilter('ai');
    }
  };

  useNewAiConversationIntent({
    enabled: searchParams.new === 'ai',
    ready: !isLoading && Boolean(user?.id),
    onConsume: clearComposeIntentFromUrl,
    onCreate: handleCreateAssistantConversation,
  });

  const handleDeleteConversation = async () => {
    if (conversationToDelete) {
      const conversation = conversations.find(c => c.id === conversationToDelete);
      if (conversation) {
        const result = await mutations.deleteConversation(conversation);
        if (result.success && selectedConversationId === conversationToDelete) {
          setSelectedConversationId(null);
        }
      }
      setConversationToDelete(null);
    }
  };

  const handleAcceptConversation = async (conversation: Conversation) => {
    if (!user?.id) return;
    await mutations.acceptConversation(conversation.id, {
      senderId: user.id,
      senderName: currentUserName,
      requesterUserId: conversation.requested_by_id ?? undefined,
    });
  };

  const handleRejectConversation = async (conversation: Conversation) => {
    const result = await mutations.rejectConversation(conversation);
    if (result.success && selectedConversationId === conversation.id) {
      setSelectedConversationId(null);
    }
  };

  const handleSendMessage = async (content: string, contextJson: string) => {
    if (selectedConversationId && user?.id) {
      const result = await mutations.sendMessage(
        selectedConversationId,
        user.id,
        content,
        undefined,
        {
          contextJson,
        }
      );
      setIsSelectedConversationAtEnd(true);
      return result.success;
    }

    return false;
  };

  const loadOlderMessages = useCallback(() => {
    setMessageLimit(limit => Math.min(limit + 80, 5000));
  }, []);

  const openNewConversationDialog = () => {
    setNewConversationSearch('');
    setNewConversationTargetUserId(undefined);
    setUserSearchDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setConversationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleRenameConversation = async (conversationId: string, name: string | null) => {
    const result = await mutations.updateConversationName(conversationId, name);
    return result.success;
  };

  return {
    t,
    isLoading,
    currentUserId: user?.id,

    // Conversation data
    filteredConversations,
    conversationOnlineStatus,
    selectedConversationId,
    setSelectedConversationId,
    selectedConversation,
    selectedMessages,
    isSelectedMessagesLoading: Boolean(selectedConversationId && isSelectedMessagesLoading),
    hasMoreOlderMessages: selectedMessages.length >= messageLimit,
    loadOlderMessages,
    setIsSelectedConversationAtEnd,
    selectedConversationUserOnline,
    searchQuery,
    setSearchQuery,
    conversationFilter,
    setConversationFilter,
    conversationSwipeHandlers,
    existingConversationUserIds,

    // Dialog state
    userSearchDialogOpen,
    setUserSearchDialogOpen: handleUserSearchDialogOpenChange,
    newConversationSearch,
    newConversationTargetUserId,
    memberListDialogOpen,
    setMemberListDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    isCancelRequest: conversations.some(
      conversation =>
        conversation.id === conversationToDelete &&
        conversation.type === 'direct' &&
        conversation.status === 'pending' &&
        isConversationRequester(conversation, user?.id)
    ),

    // Mutations
    togglePin: mutations.togglePin,

    // Handlers
    handleCreateConversationRequest,
    handleDeleteConversation,
    handleAcceptConversation,
    handleRejectConversation,
    handleSendMessage,
    openNewConversationDialog,
    handleCreateAssistantConversation,
    openDeleteDialog,
    handleRenameConversation,
  };
}
