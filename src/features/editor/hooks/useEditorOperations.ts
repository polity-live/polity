/**
 * Editor Operations Hook
 *
 * Orchestration hook that replaces editor-operations.ts Supabase utilities.
 * Composes useDocumentActions and useAmendmentActions for suggestion
 * accept/decline and voting operations.
 */

import { useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { toMutableJSONValue } from '@/zero/shared/helpers';
import type { Value } from 'platejs';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { useAmendmentActions } from '@/zero/amendments/useAmendmentActions';
import { useDocumentState } from '@/zero/documents/useDocumentState';
import type { EditorEntityType, EditorMode, TDiscussion } from '../types';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { createChangeRequestDiffSnapshot } from '@/features/change-requests/utils/suggestion-extraction';

interface SuggestionRef {
  id?: string;
  suggestionId?: string;
  keyId?: string;
  crId?: string;
}

function getDefaultVersionTitle(creationType: string): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  switch (creationType) {
    case 'suggestion_accepted':
      return `Suggestion accepted - ${timestamp}`;
    case 'suggestion_declined':
      return `Suggestion declined - ${timestamp}`;
    default:
      return `Auto-save - ${timestamp}`;
  }
}

export function useEditorOperations(entityType: EditorEntityType, entityId: string) {
  const { createVersion } = useDocumentActions();
  const {
    createChangeRequest,
    deleteChangeRequest,
    finalizeInternalChangeRequestVote,
    updateChangeRequest,
    voteOnChangeRequest,
  } = useAmendmentActions();

  // Query versions for computing next version number
  const isBlog = entityType === 'blog';
  const { versions } = useDocumentState({
    documentId: !isBlog ? entityId : undefined,
    includeVersions: !isBlog,
  });

  const latestVersionNumber =
    versions.length > 0 ? Math.max(...versions.map(v => v.version_number ?? 0)) : 0;

  const createVersionForEntity = useCallback(
    async (content: Value, creationType: string, title?: string) => {
      const versionId = crypto.randomUUID();
      const newVersionNumber = latestVersionNumber + 1;
      const versionTitle = title || getDefaultVersionTitle(creationType);

      await createVersion({
        id: versionId,
        content: toMutableJSONValue(content),
        version_number: newVersionNumber,
        change_summary: versionTitle,
        document_id: isBlog ? '' : entityId,
        amendment_id: null,
        blog_id: isBlog ? entityId : null,
      });
    },
    [entityId, isBlog, latestVersionNumber, createVersion]
  );

  const handleSuggestionCreated = useCallback(
    async (params: {
      id: string;
      crId: string;
      discussionId?: string | null;
      amendmentId: string;
      processBranchId?: string | null;
      changedCharacterCount?: number;
      change_type?: string | null;
      original_text?: string | null;
      new_text?: string | null;
      original_properties?: Record<string, string | number | boolean | null> | null;
      new_properties?: Record<string, string | number | boolean | null> | null;
      status?: string;
      votingStatus?: string;
    }) => {
      const status = params.status ?? 'open';
      try {
        await createChangeRequest({
          id: params.id,
          amendment_id: params.amendmentId,
          process_branch_id: params.processBranchId ?? null,
          discussion_id: params.discussionId ?? null,
          title: params.crId,
          description: '',
          status,
          source_type: null,
          source_id: null,
          source_title: null,
          change_type: params.change_type ?? null,
          original_text: params.original_text ?? null,
          new_text: params.new_text ?? null,
          original_properties: params.original_properties ?? null,
          new_properties: params.new_properties ?? null,
          reason: null,
          changed_character_count: params.changedCharacterCount ?? 0,
          voting_status: params.votingStatus ?? status,
          voting_deadline: null,
          voting_majority_type: null,
          quorum_required: null,
        });
        return true;
      } catch (error) {
        console.error('[useEditorOperations] Failed to create change request entity:', error);
        return false;
      }
    },
    [createChangeRequest]
  );

  const handlePendingSuggestionSubmitted = useCallback(
    async (params: {
      id: string;
      changedCharacterCount?: number;
      change_type?: string | null;
      original_text?: string | null;
      new_text?: string | null;
      original_properties?: Record<string, string | number | boolean | null> | null;
      new_properties?: Record<string, string | number | boolean | null> | null;
    }) => {
      try {
        await updateChangeRequest({
          id: params.id,
          status: 'open',
          voting_status: 'open',
          change_type: params.change_type ?? null,
          original_text: params.original_text ?? null,
          new_text: params.new_text ?? null,
          original_properties: params.original_properties ?? null,
          new_properties: params.new_properties ?? null,
          changed_character_count: params.changedCharacterCount ?? 0,
        });
        return true;
      } catch (error) {
        console.error('[useEditorOperations] Failed to submit pending change request:', error);
        return false;
      }
    },
    [updateChangeRequest]
  );

  const handlePendingSuggestionDiscarded = useCallback(
    async (changeRequestId: string) => {
      try {
        await deleteChangeRequest({ id: changeRequestId });
        return true;
      } catch (error) {
        console.error('[useEditorOperations] Failed to delete pending change request:', error);
        return false;
      }
    },
    [deleteChangeRequest]
  );

  const handleSuggestionAccepted = useCallback(
    async (
      userId: string,
      content: Value,
      discussions: TDiscussion[],
      suggestion: SuggestionRef,
      editingMode?: EditorMode,
      amendmentId?: string,
      processBranchId?: string | null
    ): Promise<{ updatedDiscussions: TDiscussion[] }> => {
      if (editingMode === 'vote_internal' || editingMode === 'event_final_closing_vote') {
        toast.error(
          translateText(
            'generated.inline.0419_this_document_is_in_voting_mode_changes_must__dc2a16a9'
          )
        );
        return { updatedDiscussions: discussions };
      }

      try {
        const versionTitle = suggestion?.crId
          ? translateText('generated.inline.0053_crid_accepted_a55aa162', { crId: suggestion.crId })
          : undefined;

        await createVersionForEntity(content, 'suggestion_accepted', versionTitle);

        const discussion = discussions.find(
          d => d.id === suggestion.suggestionId || d.id === suggestion.id
        );

        const updatedDiscussions = discussions.map(d => {
          if (d.id === suggestion.suggestionId || d.id === suggestion.id) {
            return { ...d, status: 'accepted' as const };
          }
          return d;
        });

        if (entityType === 'amendment' && discussion && amendmentId) {
          const snapshot = createChangeRequestDiffSnapshot(discussion.id, content);
          if (discussion.changeRequestEntityId) {
            await updateChangeRequest({
              id: discussion.changeRequestEntityId,
              status: 'accepted',
              voting_status: 'completed',
              change_type: snapshot.change_type,
              original_text: snapshot.original_text,
              new_text: snapshot.new_text,
              original_properties: snapshot.original_properties,
              new_properties: snapshot.new_properties,
              changed_character_count: snapshot.changed_character_count,
            });
          } else {
            const changeRequestId = crypto.randomUUID();
            await createChangeRequest({
              id: changeRequestId,
              amendment_id: amendmentId,
              process_branch_id: processBranchId ?? null,
              discussion_id: discussion.id,
              title: discussion.crId || translateText('features.editor.changeRequest'),
              description: '',
              status: 'accepted',
              source_type: null,
              source_id: null,
              source_title: null,
              change_type: snapshot.change_type,
              original_text: snapshot.original_text,
              new_text: snapshot.new_text,
              original_properties: snapshot.original_properties,
              new_properties: snapshot.new_properties,
              reason: null,
              changed_character_count: snapshot.changed_character_count,
              voting_status: 'completed',
              voting_deadline: null,
              voting_majority_type: null,
              quorum_required: null,
            });
          }
        }

        return { updatedDiscussions };
      } catch (error) {
        console.error('Failed to accept suggestion:', error);
        toast.error(translateText('generated.inline.0420_failed_to_accept_suggestion_1cf50bc4'));
        return { updatedDiscussions: discussions };
      }
    },
    [entityType, createVersionForEntity, createChangeRequest, updateChangeRequest]
  );

  const handleSuggestionDeclined = useCallback(
    async (
      userId: string,
      content: Value,
      discussions: TDiscussion[],
      suggestion: SuggestionRef,
      editingMode?: EditorMode,
      amendmentId?: string,
      processBranchId?: string | null
    ): Promise<{ updatedDiscussions: TDiscussion[] }> => {
      if (editingMode === 'vote_internal' || editingMode === 'event_final_closing_vote') {
        toast.error(
          translateText(
            'generated.inline.0421_this_document_is_in_voting_mode_changes_must__66a233c7'
          )
        );
        return { updatedDiscussions: discussions };
      }

      try {
        const versionTitle = suggestion?.crId
          ? translateText('generated.inline.0054_crid_declined_2252b75e', { crId: suggestion.crId })
          : undefined;

        await createVersionForEntity(content, 'suggestion_declined', versionTitle);

        const updatedDiscussions = discussions.map(d => {
          if (d.id === suggestion.suggestionId || d.id === suggestion.id) {
            return { ...d, status: 'rejected' as const };
          }
          return d;
        });

        if (entityType === 'amendment' && amendmentId) {
          const discussion = discussions.find(
            d => d.id === suggestion.suggestionId || d.id === suggestion.id
          );

          if (discussion) {
            const snapshot = createChangeRequestDiffSnapshot(discussion.id, content);
            if (discussion.changeRequestEntityId) {
              await updateChangeRequest({
                id: discussion.changeRequestEntityId,
                status: 'rejected',
                voting_status: 'completed',
                change_type: snapshot.change_type,
                original_text: snapshot.original_text,
                new_text: snapshot.new_text,
                original_properties: snapshot.original_properties,
                new_properties: snapshot.new_properties,
                changed_character_count: snapshot.changed_character_count,
              });
            } else {
              const changeRequestId = crypto.randomUUID();
              await createChangeRequest({
                id: changeRequestId,
                amendment_id: amendmentId,
                process_branch_id: processBranchId ?? null,
                discussion_id: discussion.id,
                title: discussion.crId || translateText('features.editor.changeRequest'),
                description: '',
                status: 'rejected',
                source_type: null,
                source_id: null,
                source_title: null,
                change_type: snapshot.change_type,
                original_text: snapshot.original_text,
                new_text: snapshot.new_text,
                original_properties: snapshot.original_properties,
                new_properties: snapshot.new_properties,
                reason: null,
                changed_character_count: snapshot.changed_character_count,
                voting_status: 'completed',
                voting_deadline: null,
                voting_majority_type: null,
                quorum_required: null,
              });
            }
          }
        }

        return { updatedDiscussions };
      } catch (error) {
        console.error('Failed to decline suggestion:', error);
        toast.error(translateText('generated.inline.0422_failed_to_decline_suggestion_b404c243'));
        return { updatedDiscussions: discussions };
      }
    },
    [entityType, createVersionForEntity, createChangeRequest, updateChangeRequest]
  );

  const handleVoteOnSuggestion = useCallback(
    async (
      amendmentId: string,
      userId: string,
      discussions: TDiscussion[],
      suggestion: SuggestionRef,
      voteType: 'accept' | 'reject' | 'abstain',
      processBranchId?: string | null
    ): Promise<void> => {
      try {
        const discussion = discussions.find(
          d => d.id === suggestion.suggestionId || d.id === suggestion.id
        );

        if (!discussion) {
          toast.error(translateText('generated.inline.0423_suggestion_not_found_26722c9c'));
          return;
        }

        let changeRequestId = discussion.changeRequestEntityId;

        if (!changeRequestId) {
          // Fallback: create change request if none exists yet
          changeRequestId = crypto.randomUUID();
          await createChangeRequest({
            id: changeRequestId,
            amendment_id: amendmentId,
            process_branch_id: processBranchId ?? null,
            discussion_id: discussion.id,
            title: discussion.crId || translateText('features.editor.changeRequest'),
            description: '',
            status: 'pending',
            source_type: null,
            source_id: null,
            source_title: null,
            reason: null,
            changed_character_count: 0,
            voting_status: 'open',
            voting_deadline: null,
            voting_majority_type: null,
            quorum_required: null,
          });
        }

        // Cast the vote on the change request
        const voteId = crypto.randomUUID();
        await voteOnChangeRequest({
          id: voteId,
          change_request_id: changeRequestId,
          vote: voteType,
        });

        toast.success(translateText('generated.inline.0424_vote_recorded_871f8900'));
      } catch (error) {
        console.error('Failed to vote on suggestion:', error);
        toast.error(translateText('generated.inline.0425_failed_to_record_vote_46deda26'));
      }
    },
    [createChangeRequest, voteOnChangeRequest]
  );

  const handleFinalizeInternalVoteOnSuggestion = useCallback(
    async (discussions: TDiscussion[], suggestion: SuggestionRef): Promise<void> => {
      const discussion = discussions.find(
        d => d.id === suggestion.suggestionId || d.id === suggestion.id
      );
      const changeRequestId = discussion?.changeRequestEntityId;

      if (!changeRequestId) {
        toast.error(translateText('generated.inline.0423_suggestion_not_found_26722c9c'));
        return;
      }

      await finalizeInternalChangeRequestVote({ change_request_id: changeRequestId });
    },
    [finalizeInternalChangeRequestVote]
  );

  return {
    handleSuggestionCreated,
    handlePendingSuggestionSubmitted,
    handlePendingSuggestionDiscarded,
    handleSuggestionAccepted,
    handleSuggestionDeclined,
    handleVoteOnSuggestion,
    handleFinalizeInternalVoteOnSuggestion,
  };
}
