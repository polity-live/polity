import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useOnlineUsers } from '@/presence';
import { useAuth } from '@/providers/auth-provider';
import { useUserState } from '@/zero/users/useUserState';
import { useConversationData } from './useConversationData';
import { useMessageMutations } from './useMessageMutations';
import { useConversationFilters } from './useConversationFilters';
import { useConversationSelection } from './useConversationSelection';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { Conversation } from '../types/message.types';
import { isAssistantConversation } from '@/features/assistant/logic/assistantHelpers';

export function useMessagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { onlineUserIds } = useOnlineUsers();
  const searchParams = useSearch({ strict: false }) as Record<string, string>;

  // Dialog state
  const [userSearchDialogOpen, setUserSearchDialogOpen] = useState(false);
  const [newConversationSearch, setNewConversationSearch] = useState('');
  const [memberListDialogOpen, setMemberListDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

  // Current user name for notifications
  const { currentUser: currentUserData } = useUserState();
  const currentUserName =
    `${currentUserData?.first_name ?? ''} ${currentUserData?.last_name ?? ''}`.trim() || 'Someone';

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

  const conversationOnlineStatus = useMemo<Record<string, boolean>>(() => {
    const statusByConversationId: Record<string, boolean> = {};

    for (const conversation of conversations) {
      if (conversation.type === 'group' || conversation.status !== 'accepted') {
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

  // Existing direct conversation user IDs (for new conversation dialog)
  const existingConversationUserIds = useMemo(() => {
    return conversations
      .filter(conv => conv.type === 'direct' && !isAssistantConversation(conv))
      .flatMap(conv => conv.participants.map(p => p.user?.id))
      .filter((id): id is string => id !== undefined && id !== user?.id);
  }, [conversations, user?.id]);

  const messageConversationId = searchParams.conversationId;
  const messageUserId = searchParams.userId;
  const messageUserName = searchParams.name || '';

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
      if (conv.type === 'group' || isAssistantConversation(conv)) return false;
      return conv.participants.some(p => p.user?.id === messageUserId);
    });

    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      setSearchQuery('');
      setUserSearchDialogOpen(false);
      setNewConversationSearch('');
      clearComposeIntentFromUrl();
      return;
    }

    if (!messageUserName) return;

    setUserSearchDialogOpen(true);
    setNewConversationSearch(messageUserName);
    clearComposeIntentFromUrl();
  }, [
    messageConversationId,
    messageUserId,
    messageUserName,
    conversations,
    isLoading,
    clearComposeIntentFromUrl,
    setSearchQuery,
    setSelectedConversationId,
  ]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;

    void mutations.markConversationAsRead(selectedConversation, user.id);
  }, [selectedConversation?.id, selectedConversation?.messages, user?.id]);

  // Handlers
  const handleCreateConversationRequest = async (otherUserId: string) => {
    if (!user?.id) return;

    const existingConversation = conversations.find(conv => {
      if (conv.type === 'group' || isAssistantConversation(conv)) return false;
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
      clearComposeIntentFromUrl();
    }
  };

  const handleCreateAssistantConversation = async () => {
    if (!user?.id) return;

    const result = await mutations.createAssistantConversation(
      user.id,
      t('features.messages.ai.defaultConversationName', 'Aria & Kai')
    );

    if (result.success && result.conversationId) {
      setSelectedConversationId(result.conversationId);
      setSearchQuery('');
      setConversationFilter('ai');
    }
  };

  const handleDeleteConversation = async () => {
    if (conversationToDelete) {
      const conversation = conversations.find(c => c.id === conversationToDelete);
      if (conversation) {
        await mutations.deleteConversation(conversation);
        if (selectedConversationId === conversationToDelete) {
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
      requesterUserId: conversation.requested_by?.id,
    });
  };

  const handleRejectConversation = (conversation: Conversation) => {
    mutations.rejectConversation(conversation);
    if (selectedConversationId === conversation.id) {
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
      return result.success;
    }

    return false;
  };

  const openNewConversationDialog = () => {
    setNewConversationSearch('');
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
    selectedConversationUserOnline,
    searchQuery,
    setSearchQuery,
    conversationFilter,
    setConversationFilter,
    existingConversationUserIds,

    // Dialog state
    userSearchDialogOpen,
    setUserSearchDialogOpen: handleUserSearchDialogOpenChange,
    newConversationSearch,
    memberListDialogOpen,
    setMemberListDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,

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
