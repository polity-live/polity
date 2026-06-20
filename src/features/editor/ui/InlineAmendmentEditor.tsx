'use client';

/**
 * Inline Amendment Editor
 *
 * A compact interactive editor for embedding in CR card previews.
 * Uses useEditor internally for state management and persistence.
 * Renders PlateEditor in suggest_event mode with the toolbar.
 */

import { useMemo, useCallback } from 'react';
import { useEditor } from '../hooks/useEditor';
import { useEditorOperations } from '../hooks/useEditorOperations';
import { useEditorUsers } from '../hooks/useEditorUsers';
import { useSuggestionIdAssignment } from '@/features/documents/hooks/use-suggestion-id-assignment';
import {
  countChangedCharacters,
  createChangeRequestDiffSnapshot,
  createChangeRequestDiffSnapshotFromContent,
  type SuggestionContent,
} from '@/features/change-requests/utils/suggestion-extraction';
import type { ResolvedSuggestion } from '@/features/shared/ui/ui-platejs/block-suggestion';
import { toast } from '@/features/shared/ui/ui/sonner';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { EditorUser } from '../types';

interface InlineAmendmentEditorProps {
  amendmentId: string;
  userId?: string;
  userRecord?: {
    id: string;
    name?: string;
    email?: string | null;
    avatar?: string;
  };
  agendaItemId?: string;
  /** Editor mode to use — defaults to 'suggest_event' */
  editingMode?: string | null;
}
import { InlineAmendmentEditorView } from './InlineAmendmentEditorView';

function getSuggestionDiscussionId(suggestion: ResolvedSuggestion) {
  return (
    suggestion.keyId?.replace('suggestion_', '') ||
    suggestion.suggestionId ||
    (suggestion as { id?: string }).id
  );
}

function createSnapshotFromResolvedSuggestion(suggestion: ResolvedSuggestion) {
  const content: SuggestionContent = {
    type: suggestion.type ?? 'unknown',
    text: (suggestion as { text?: string }).text ?? '',
    newText: suggestion.newText ?? '',
    properties: (suggestion as { properties?: SuggestionContent['properties'] }).properties ?? {},
    newProperties: suggestion.newProperties ?? {},
  };

  return {
    ...createChangeRequestDiffSnapshotFromContent(content),
    changed_character_count: countChangedCharacters(content),
  };
}

export function InlineAmendmentEditor({
  amendmentId,
  userId,
  userRecord,
  agendaItemId,
  editingMode,
}: InlineAmendmentEditorProps) {
  const resolvedMode = (editingMode === 'vote_event' ? 'vote_event' : 'suggest_event') as
    | 'suggest_event'
    | 'vote_event';
  const {
    entity,
    isLoading,
    content,
    discussions,
    mode,
    selectedCrIds,
    setContent,
    setDiscussions,
    setSelectedCrIds,
  } = useEditor({
    entityType: 'amendment',
    entityId: amendmentId,
    userId,
    agendaItemId,
  });

  const contentEntityId = entity?.id ?? '';
  const amendmentIdFromEntity = entity?.metadata?.amendmentId;

  const editorOps = useEditorOperations('amendment', contentEntityId);

  const entityCurrentUser = useMemo<EditorUser | undefined>(() => {
    if (!userId || !entity) return undefined;
    if (entity.owner?.id === userId) return entity.owner;
    return (
      entity.collaborators.find(collab => collab.user?.id === userId)?.user ??
      entity.extraUsers?.find(user => user.id === userId)
    );
  }, [entity, userId]);

  const currentUser: EditorUser | undefined = useMemo(() => {
    if (!userId) return undefined;
    return {
      id: userId,
      name:
        userRecord?.name ||
        entityCurrentUser?.name ||
        userRecord?.email ||
        entityCurrentUser?.email ||
        'Anonymous',
      email: userRecord?.email ?? entityCurrentUser?.email,
      avatarUrl: userRecord?.avatar || entityCurrentUser?.avatarUrl,
    };
  }, [entityCurrentUser, userId, userRecord]);

  const editorUsers = useEditorUsers(entity, currentUser);

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
      if (!amendmentIdFromEntity) return;
      const snapshot = createChangeRequestDiffSnapshot(discussionId, content);
      editorOps.handleSuggestionCreated({
        id: changeRequestEntityId,
        crId,
        amendmentId: amendmentIdFromEntity,
        changedCharacterCount: snapshot.changed_character_count,
        change_type: snapshot.change_type,
        original_text: snapshot.original_text,
        new_text: snapshot.new_text,
        original_properties: snapshot.original_properties,
        new_properties: snapshot.new_properties,
      });
    },
    [amendmentIdFromEntity, content, editorOps]
  );

  useSuggestionIdAssignment({
    enabled: resolvedMode === 'suggest_event',
    confirmationMode: resolvedMode === 'suggest_event' ? 'event_suggestion' : 'none',
    documentId: contentEntityId,
    discussions,
    onDiscussionsUpdate: setDiscussions,
    onChangeRequestCreate: handleChangeRequestCreate,
  });

  const onSuggestionAccepted = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !content) return;
      const { updatedDiscussions } = await editorOps.handleSuggestionAccepted(
        userId,
        content,
        discussions,
        suggestion,
        mode,
        amendmentIdFromEntity
      );
      setDiscussions(updatedDiscussions);
    },
    [
      contentEntityId,
      userId,
      content,
      discussions,
      mode,
      amendmentIdFromEntity,
      setDiscussions,
      editorOps,
    ]
  );

  const onSuggestionDeclined = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (!contentEntityId || !userId || !content) return;
      const { updatedDiscussions } = await editorOps.handleSuggestionDeclined(
        userId,
        content,
        discussions,
        suggestion,
        mode,
        amendmentIdFromEntity
      );
      setDiscussions(updatedDiscussions);
    },
    [
      contentEntityId,
      userId,
      content,
      discussions,
      mode,
      amendmentIdFromEntity,
      setDiscussions,
      editorOps,
    ]
  );

  const onEventSuggestionConfirm = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (resolvedMode !== 'suggest_event' || !amendmentIdFromEntity) return;

      const discussionId = getSuggestionDiscussionId(suggestion);
      const discussion = discussions.find(d => d.id === discussionId);
      if (!discussion) {
        toast.error(
          translateText(
            'features.amendments.eventSuggestions.confirmMissingDiscussion',
            'Suggestion not found.'
          )
        );
        return;
      }

      if (discussion.changeRequestEntityId) {
        await setDiscussions(
          discussions.map(d =>
            d.id === discussion.id
              ? { ...d, confirmationStatus: 'confirmed', confirmedAt: d.confirmedAt ?? Date.now() }
              : d
          )
        );
        return;
      }

      const crId = discussion.crId || suggestion.crId;
      if (!crId) {
        toast.error(
          translateText(
            'features.amendments.eventSuggestions.confirmMissingCrId',
            'Suggestion is still being prepared.'
          )
        );
        return;
      }

      const changeRequestEntityId = crypto.randomUUID();
      const snapshot = createSnapshotFromResolvedSuggestion(suggestion);
      const created = await editorOps.handleSuggestionCreated({
        id: changeRequestEntityId,
        crId,
        amendmentId: amendmentIdFromEntity,
        changedCharacterCount: snapshot.changed_character_count,
        change_type: snapshot.change_type,
        original_text: snapshot.original_text,
        new_text: snapshot.new_text,
        original_properties: snapshot.original_properties,
        new_properties: snapshot.new_properties,
      });

      if (!created) {
        toast.error(
          translateText(
            'features.amendments.eventSuggestions.confirmFailed',
            'Failed to submit change request.'
          )
        );
        return;
      }

      await setDiscussions(
        discussions.map(d =>
          d.id === discussion.id
            ? {
                ...d,
                crId,
                changeRequestEntityId,
                confirmationStatus: 'confirmed',
                confirmedAt: Date.now(),
              }
            : d
        )
      );
      toast.success(
        translateText('features.amendments.eventSuggestions.confirmed', 'Change request submitted.')
      );
    },
    [amendmentIdFromEntity, discussions, editorOps, resolvedMode, setDiscussions]
  );

  const onEventSuggestionCancel = useCallback(
    async (suggestion: ResolvedSuggestion) => {
      if (resolvedMode !== 'suggest_event') return;

      const discussionId = getSuggestionDiscussionId(suggestion);
      const discussion = discussions.find(d => d.id === discussionId);
      if (discussion?.changeRequestEntityId || discussion?.confirmationStatus === 'confirmed') {
        toast.error(
          translateText(
            'features.amendments.eventSuggestions.cancelConfirmed',
            'Submitted change requests cannot be withdrawn.'
          )
        );
        return;
      }

      await setDiscussions(discussions.filter(d => d.id !== discussionId));
      toast.success(
        translateText('features.amendments.eventSuggestions.cancelled', 'Suggestion discarded.')
      );
    },
    [discussions, resolvedMode, setDiscussions]
  );

  return (
    <InlineAmendmentEditorView
      amendmentId={amendmentId}
      userId={userId}
      userRecord={userRecord}
      agendaItemId={agendaItemId}
      editingMode={editingMode}
      resolvedMode={resolvedMode}
      entity={entity}
      isLoading={isLoading}
      content={content}
      discussions={discussions}
      mode={mode}
      selectedCrIds={selectedCrIds}
      setContent={setContent}
      setDiscussions={setDiscussions}
      setSelectedCrIds={setSelectedCrIds}
      contentEntityId={contentEntityId}
      amendmentIdFromEntity={amendmentIdFromEntity}
      editorOps={editorOps}
      currentUser={currentUser}
      editorUsers={editorUsers}
      handleChangeRequestCreate={handleChangeRequestCreate}
      onSuggestionAccepted={onSuggestionAccepted}
      onSuggestionDeclined={onSuggestionDeclined}
      onEventSuggestionConfirm={onEventSuggestionConfirm}
      onEventSuggestionCancel={onEventSuggestionCancel}
    />
  );
}
