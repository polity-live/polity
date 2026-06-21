'use client';

import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import {
  useTranslation,
  translate as translateText,
} from '@/features/shared/hooks/use-translation';
import { useSuggestionIdAssignment } from '@/features/documents/hooks/use-suggestion-id-assignment.ts';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';
import type { ResolvedSuggestion } from '@/features/shared/ui/ui-platejs/block-suggestion.tsx';

import { generateDistinctUserColorMap } from '../logic/editor-helpers';
import type { EditorUser, EditorViewProps } from '../types';
import { useEditor } from './useEditor';
import { useEditorOperations } from './useEditorOperations';
import { useEditorPresence } from './useEditorPresence';
import { useEditorUsers } from './useEditorUsers';

export function useEditorViewModel({
  entityType,
  entityId,
  userId,
  readOnly = false,
  userRecord,
  capabilities: capabilitiesOverride,
  backUrl,
  backLabel,
  compactToolbarSpacing = false,
  agendaItemId,
  processBranchId,
}: EditorViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Main editor hook
  const editorState = useEditor({
    entityType,
    entityId,
    userId,
    readOnly,
    capabilities: capabilitiesOverride,
    agendaItemId,
    processBranchId,
  });

  const {
    entity,
    isLoading,
    title,
    content,
    discussions,
    mode,
    modeDisabledReasons,
    saveStatus,
    hasUnsavedChanges,
    isSavingTitle,
    hasAccess,
    isOwnerOrCollaborator,
    canVoteOnChangeRequests,
    canManageChangeRequestVotes,
    capabilities,
    setTitle,
    setContent,
    setDiscussions,
    setMode,
    setSelectedCrIds,
    selectedCrIds,
    restoreVersion,
  } = editorState;

  // Build current user object
  const currentUser: EditorUser | undefined = useMemo(() => {
    if (!userId) return undefined;
    return {
      id: userId,
      name: userRecord?.name || userRecord?.email || 'Anonymous',
      email: userRecord?.email,
      avatarUrl: userRecord?.avatar,
    };
  }, [userId, userRecord]);

  const presenceColorByUserId = useMemo(() => {
    const visibleUserIds = new Set<string>();

    if (currentUser?.id) {
      visibleUserIds.add(currentUser.id);
    }
    if (entity?.owner?.id) {
      visibleUserIds.add(entity.owner.id);
    }
    for (const collaborator of entity?.collaborators ?? []) {
      if (collaborator.user.id) {
        visibleUserIds.add(collaborator.user.id);
      }
    }
    for (const user of entity?.extraUsers ?? []) {
      if (user.id) {
        visibleUserIds.add(user.id);
      }
    }

    return generateDistinctUserColorMap(visibleUserIds);
  }, [currentUser?.id, entity]);

  // Get the content entity ID (document ID for amendments, blog ID for blogs)
  const contentEntityId = useMemo(() => {
    if (entityType === 'amendment') {
      return entity?.id || '';
    }
    return entityId;
  }, [entityType, entityId, entity?.id]);

  // Presence hook
  const { onlinePeers, userColor } = useEditorPresence({
    entityId: contentEntityId,
    userId,
    userName: userRecord?.name || userRecord?.email || 'Anonymous',
    userAvatar: userRecord?.avatar,
    userColorByUserId: presenceColorByUserId,
    enabled: capabilities.presence,
  });

  // Map of online peer userId → peer (for collaborator online indicators)
  const onlinePeerMap = useMemo(() => {
    const map = new Map<string, (typeof onlinePeers)[number]>();
    for (const peer of onlinePeers) {
      map.set(peer.userId, peer);
    }
    return map;
  }, [onlinePeers]);

  // Build users map for the editor
  const editorUsers = useEditorUsers(entity, currentUser);

  // Track which remote users have active cursors in the editor
  const [activeCursorUserIds, setActiveCursorUserIds] = useState<Set<string>>(new Set());

  // Editor operations (suggestion accept/decline/vote via Zero)
  const editorOps = useEditorOperations(entityType, contentEntityId);

  // Get amendment-specific data
  const amendmentId = entity?.metadata?.amendmentId;
  const effectiveProcessBranchId = entity?.metadata?.processBranchId ?? processBranchId ?? null;

  // Callback to persist a change_request entity when a suggestion is created
  const handleChangeRequestCreate = useCallback(
    ({
      crId,
      discussionId,
      changeRequestEntityId,
    }: {
      crId: string;
      discussionId: string;
      changeRequestEntityId: string;
    }) => {
      console.log('[EditorView] handleChangeRequestCreate called:', {
        crId,
        changeRequestEntityId,
        amendmentId,
        entityType,
      });
      if (!amendmentId) return;
      const snapshot = createChangeRequestDiffSnapshot(discussionId, content);
      editorOps.handleSuggestionCreated({
        id: changeRequestEntityId,
        crId,
        amendmentId,
        processBranchId: effectiveProcessBranchId,
        changedCharacterCount: snapshot.changed_character_count,
        change_type: snapshot.change_type,
        original_text: snapshot.original_text,
        new_text: snapshot.new_text,
        original_properties: snapshot.original_properties,
        new_properties: snapshot.new_properties,
      });
    },
    [amendmentId, content, effectiveProcessBranchId, editorOps]
  );

  // Auto-assign suggestion IDs
  useSuggestionIdAssignment({
    enabled: !(
      entityType === 'amendment' &&
      (mode === 'suggest_event' || mode === 'event_final_closing_vote')
    ),
    documentId: contentEntityId,
    discussions,
    onDiscussionsUpdate: setDiscussions,
    onChangeRequestCreate: entityType === 'amendment' ? handleChangeRequestCreate : undefined,
  });
  const amendmentTitle = entity?.metadata?.amendmentCode
    ? `${entity.metadata.amendmentCode} - ${title}`
    : title;

  // Handle suggestion accepted
  const onSuggestionAccepted = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !content) return;

      const { updatedDiscussions } = await editorOps.handleSuggestionAccepted(
        userId,
        content,
        discussions,
        suggestion,
        mode,
        amendmentId,
        effectiveProcessBranchId
      );

      setDiscussions(updatedDiscussions);
    },
    [
      contentEntityId,
      userId,
      content,
      discussions,
      mode,
      amendmentId,
      effectiveProcessBranchId,
      setDiscussions,
      editorOps,
    ]
  );

  // Handle suggestion declined
  const onSuggestionDeclined = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !content) return;

      const { updatedDiscussions } = await editorOps.handleSuggestionDeclined(
        userId,
        content,
        discussions,
        suggestion,
        mode,
        amendmentId,
        effectiveProcessBranchId
      );

      setDiscussions(updatedDiscussions);
    },
    [
      contentEntityId,
      userId,
      content,
      discussions,
      mode,
      amendmentId,
      effectiveProcessBranchId,
      setDiscussions,
      editorOps,
    ]
  );

  // Handle voting
  const onVoteAccept = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !amendmentId) return;
      await editorOps.handleVoteOnSuggestion(
        amendmentId,
        userId,
        discussions,
        suggestion,
        'accept',
        effectiveProcessBranchId
      );
    },
    [contentEntityId, amendmentId, userId, discussions, effectiveProcessBranchId, editorOps]
  );

  const onVoteReject = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !amendmentId) return;
      await editorOps.handleVoteOnSuggestion(
        amendmentId,
        userId,
        discussions,
        suggestion,
        'reject',
        effectiveProcessBranchId
      );
    },
    [contentEntityId, amendmentId, userId, discussions, effectiveProcessBranchId, editorOps]
  );

  const onVoteAbstain = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !amendmentId) return;
      await editorOps.handleVoteOnSuggestion(
        amendmentId,
        userId,
        discussions,
        suggestion,
        'abstain',
        effectiveProcessBranchId
      );
    },
    [contentEntityId, amendmentId, userId, discussions, effectiveProcessBranchId, editorOps]
  );

  const onFinalizeInternalVote = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !amendmentId) return;
      await editorOps.handleFinalizeInternalVoteOnSuggestion(discussions, suggestion);
    },
    [contentEntityId, amendmentId, discussions, editorOps]
  );

  // Get existing collaborator IDs
  const existingCollaboratorIds = useMemo(() => {
    if (!entity) return [];
    const ids = entity.collaborators.map(c => c.user.id);
    if (entity.owner?.id) ids.push(entity.owner.id);
    return ids;
  }, [entity]);

  // Status badge based on entity type
  const statusBadgeLabel = useMemo(() => {
    if (!entity) return null;
    if (entityType === 'amendment' && entity.metadata?.amendmentEditingMode) {
      return entity.metadata.amendmentEditingMode;
    }
    if (entityType === 'blog') {
      return entity.visibility === 'public'
        ? translateText('generated.inline.0063_public_dc5eb704')
        : entity.visibility === 'authenticated'
          ? translateText('generated.inline.0064_authenticated_c2be8376')
          : translateText('generated.inline.0065_private_237dfa0a');
    }
    return null;
  }, [entityType, entity]);

  // Default back navigation
  const defaultBackUrl = useMemo(() => {
    switch (entityType) {
      case 'amendment':
        return `/amendment/${entityId}`;
      case 'blog': {
        const groupId = entity?.metadata?.groupId;
        const ownerId = entity?.owner?.id;
        if (groupId) return `/group/${groupId}/blog/${entityId}`;
        if (ownerId) return `/user/${ownerId}/blog/${entityId}`;
        return `/blog/${entityId}`;
      }
      case 'document':
        return '/editor';
      case 'groupDocument':
        return entity?.metadata?.groupId ? `/group/${entity.metadata.groupId}/editor` : '/';
      default:
        return '/';
    }
  }, [entityType, entityId, entity?.metadata?.groupId, entity?.owner?.id]);

  const defaultBackLabel = useMemo(() => {
    switch (entityType) {
      case 'amendment':
        return t('features.editor.navigation.backToAmendment');
      case 'blog':
        return t('features.editor.navigation.backToBlog');
      case 'document':
        return t('features.editor.navigation.backToDocuments');
      case 'groupDocument':
        return t('features.editor.navigation.backToDocuments');
      default:
        return t('common.back');
    }
  }, [entityType, t]);

  const goBack = useCallback(() => {
    navigate({ to: backUrl || defaultBackUrl });
  }, [backUrl, defaultBackUrl, navigate]);

  return {
    activeCursorUserIds,
    amendmentId,
    amendmentTitle,
    backLabel,
    backUrl,
    canManageChangeRequestVotes,
    canVoteOnChangeRequests,
    capabilities,
    compactToolbarSpacing,
    content,
    contentEntityId,
    currentUser,
    defaultBackLabel,
    defaultBackUrl,
    discussions,
    editorUsers,
    entity,
    entityId,
    entityType,
    existingCollaboratorIds,
    goBack,
    hasAccess,
    hasUnsavedChanges,
    isEditingTitle,
    isLoading,
    isOwnerOrCollaborator,
    isSavingTitle,
    mode,
    modeDisabledReasons,
    onSuggestionAccepted,
    onSuggestionDeclined,
    onFinalizeInternalVote,
    onVoteAbstain,
    onVoteAccept,
    onVoteReject,
    onlinePeerMap,
    onlinePeers,
    presenceColorByUserId,
    readOnly,
    restoreVersion,
    saveStatus,
    selectedCrIds,
    setActiveCursorUserIds,
    setContent,
    setDiscussions,
    setIsEditingTitle,
    setMode,
    setSelectedCrIds,
    setTitle,
    statusBadgeLabel,
    title,
    userColor,
    userId,
  };
}

export type EditorViewModel = ReturnType<typeof useEditorViewModel>;
