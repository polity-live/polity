// use-suggestion-id-assignment.ts
// Hook for automatically assigning CR-x IDs to suggestions

import React from 'react';
import { getNextSuggestionIdFromDiscussions } from '@/features/shared/utils/suggestion-utils.ts';
import type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit.tsx';
import type { ResolvedSuggestion } from '@/features/shared/ui/ui-platejs/block-suggestion.tsx';
import {
  editorSelectionDebugLog,
  summarizeDiscussion,
  summarizeDiscussions,
} from '@/features/shared/logic/editorSelectionDebug';

interface UseSuggestionIdAssignmentProps {
  enabled?: boolean;
  confirmationMode?: 'none' | 'event_suggestion';
  documentId: string;
  discussions: TDiscussion[];
  onDiscussionsUpdate: (discussions: TDiscussion[]) => void;
  onChangeRequestCreate?: (params: {
    crId: string;
    discussionId: string;
    changeRequestEntityId: string;
    status?: string;
    votingStatus?: string;
  }) => unknown | Promise<unknown>;
  suggestions?: ResolvedSuggestion[]; // Optional: resolved suggestions from PlateJS
}

/**
 * Hook that automatically assigns CR-x IDs to suggestions that don't have them
 * Should be called whenever discussions change in the editor
 */
export function useSuggestionIdAssignment({
  enabled = true,
  confirmationMode = 'none',
  documentId,
  discussions,
  onDiscussionsUpdate,
  onChangeRequestCreate,
}: UseSuggestionIdAssignmentProps) {
  const processedDiscussions = React.useRef(new Set<string>());
  const processedEntities = React.useRef(new Set<string>());

  const assignMissingIds = React.useCallback(async () => {
    if (!enabled) return;
    if (!documentId || !discussions || discussions.length === 0) return;

    const updatedDiscussions = [...discussions];
    let hasChanges = false;
    const requiresEventConfirmation = confirmationMode === 'event_suggestion';

    // Pass 1: Assign crId to discussions that don't have one
    const discussionsNeedingIds = discussions.filter(
      discussion => !discussion.crId && !processedDiscussions.current.has(discussion.id)
    );

    if (discussionsNeedingIds.length > 0) {
      // Sort by creation date to maintain chronological order for ID assignment
      discussionsNeedingIds.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (const discussion of discussionsNeedingIds) {
        const crId = getNextSuggestionIdFromDiscussions(updatedDiscussions);
        const index = updatedDiscussions.findIndex(d => d.id === discussion.id);

        if (index !== -1) {
          updatedDiscussions[index] = {
            ...updatedDiscussions[index],
            crId,
            confirmationStatus: requiresEventConfirmation
              ? (updatedDiscussions[index].confirmationStatus ?? 'pending')
              : updatedDiscussions[index].confirmationStatus,
            changeRequestStatus: requiresEventConfirmation
              ? (updatedDiscussions[index].changeRequestStatus ?? 'pending_submission')
              : updatedDiscussions[index].changeRequestStatus,
          };
          processedDiscussions.current.add(discussion.id);
          hasChanges = true;
        }
      }
    }

    if (requiresEventConfirmation) {
      for (const discussion of updatedDiscussions) {
        const index = updatedDiscussions.findIndex(d => d.id === discussion.id);
        if (index === -1) continue;

        const nextConfirmationStatus = discussion.confirmationStatus ?? 'pending';

        if (discussion.confirmationStatus !== nextConfirmationStatus) {
          updatedDiscussions[index] = {
            ...updatedDiscussions[index],
            confirmationStatus: nextConfirmationStatus,
            changeRequestStatus:
              updatedDiscussions[index].changeRequestStatus ?? 'pending_submission',
          };
          hasChanges = true;
        }
      }
    }

    // Pass 2: Create change_request entities for discussions that have crId but no entity
    if (onChangeRequestCreate) {
      const discussionsNeedingEntity = updatedDiscussions.filter(
        discussion =>
          discussion.crId &&
          !discussion.changeRequestEntityId &&
          !processedEntities.current.has(discussion.id)
      );

      if (discussionsNeedingEntity.length > 0) {
        editorSelectionDebugLog('suggestion-assignment:pass2:start', {
          count: discussionsNeedingEntity.length,
          discussions: summarizeDiscussions(discussionsNeedingEntity),
          documentId,
          requiresEventConfirmation,
          updatedDiscussions: summarizeDiscussions(updatedDiscussions),
        });

        const createRequests: {
          crId: string;
          discussionId: string;
          changeRequestEntityId: string;
          status: string;
          votingStatus: string;
        }[] = [];

        for (const discussion of discussionsNeedingEntity) {
          const crId = discussion.crId;
          if (!crId) {
            continue;
          }

          const changeRequestEntityId = crypto.randomUUID();
          const index = updatedDiscussions.findIndex(d => d.id === discussion.id);

          if (index !== -1) {
            editorSelectionDebugLog('suggestion-assignment:pass2:before-update', {
              changeRequestEntityId,
              crId,
              discussion: summarizeDiscussion(updatedDiscussions[index]),
              discussionId: discussion.id,
              documentId,
            });

            updatedDiscussions[index] = {
              ...updatedDiscussions[index],
              changeRequestEntityId,
              changeRequestStatus: requiresEventConfirmation ? 'pending_submission' : 'open',
            };
            processedEntities.current.add(discussion.id);
            hasChanges = true;

            editorSelectionDebugLog('suggestion-assignment:pass2:after-update', {
              changeRequestEntityId,
              crId,
              discussion: summarizeDiscussion(updatedDiscussions[index]),
              discussionId: discussion.id,
              documentId,
            });

            createRequests.push({
              crId,
              discussionId: discussion.id,
              changeRequestEntityId,
              status: requiresEventConfirmation ? 'pending_submission' : 'open',
              votingStatus: requiresEventConfirmation ? 'pending_submission' : 'open',
            });
          }
        }

        if (createRequests.length > 0 && hasChanges) {
          editorSelectionDebugLog('suggestion-assignment:on-discussions-update:before-create', {
            documentId,
            updatedDiscussions: summarizeDiscussions(updatedDiscussions),
          });
          onDiscussionsUpdate(updatedDiscussions);
          hasChanges = false;
        }

        for (const request of createRequests) {
          await onChangeRequestCreate(request);
        }
      }
    }

    if (hasChanges) {
      editorSelectionDebugLog('suggestion-assignment:on-discussions-update', {
        documentId,
        updatedDiscussions: summarizeDiscussions(updatedDiscussions),
      });
      onDiscussionsUpdate(updatedDiscussions);
    }
  }, [
    confirmationMode,
    documentId,
    discussions,
    enabled,
    onDiscussionsUpdate,
    onChangeRequestCreate,
  ]);

  // Run the assignment whenever discussions change
  React.useEffect(() => {
    void assignMissingIds();
  }, [assignMissingIds]);

  // Clean up processed discussions when component unmounts or documentId changes
  React.useEffect(() => {
    return () => {
      processedDiscussions.current.clear();
      processedEntities.current.clear();
    };
  }, [documentId]);

  return {
    assignMissingIds,
  };
}
