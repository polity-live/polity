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
import { useSuggestionIdAssignment } from '@/features/documents/hooks/use-suggestion-id-assignment';
import { countChangedCharactersForSuggestion } from '@/features/change-requests/utils/suggestion-extraction';
import type { ResolvedSuggestion } from '@/features/shared/ui/ui-platejs/block-suggestion';
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

  const currentUser: EditorUser | undefined = useMemo(() => {
    if (!userId) return undefined;
    return {
      id: userId,
      name: userRecord?.name || userRecord?.email || 'Anonymous',
      email: userRecord?.email ?? undefined,
      avatarUrl: userRecord?.avatar,
    };
  }, [userId, userRecord]);

  const editorUsers = useMemo(() => {
    if (!currentUser) return {};
    return {
      [currentUser.id]: {
        id: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl || '',
      },
    };
  }, [currentUser]);

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
      editorOps.handleSuggestionCreated({
        id: changeRequestEntityId,
        crId,
        amendmentId: amendmentIdFromEntity,
        changedCharacterCount: countChangedCharactersForSuggestion(discussionId, content),
      });
    },
    [amendmentIdFromEntity, content, editorOps]
  );

  useSuggestionIdAssignment({
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
    />
  );
}
