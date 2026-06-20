// use-suggestion-id-assignment.ts
// Hook for automatically assigning CR-x IDs to suggestions

import React from 'react';
import { getNextSuggestionIdFromDiscussions } from '@/features/shared/utils/suggestion-utils.ts';
import type { TDiscussion } from '@/features/shared/ui/kit-platejs/discussion-kit.tsx';
import type { ResolvedSuggestion } from '@/features/shared/ui/ui-platejs/block-suggestion.tsx';

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

  const assignMissingIds = React.useCallback(() => {
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
      console.log(
        '[useSuggestionIdAssignment] Pass 1: Found',
        discussionsNeedingIds.length,
        'discussions needing crId'
      );

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
              ? updatedDiscussions[index].changeRequestEntityId
                ? 'confirmed'
                : (updatedDiscussions[index].confirmationStatus ?? 'pending')
              : updatedDiscussions[index].confirmationStatus,
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

        const nextConfirmationStatus = discussion.changeRequestEntityId
          ? 'confirmed'
          : (discussion.confirmationStatus ?? 'pending');

        if (discussion.confirmationStatus !== nextConfirmationStatus) {
          updatedDiscussions[index] = {
            ...updatedDiscussions[index],
            confirmationStatus: nextConfirmationStatus,
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
          (!requiresEventConfirmation || discussion.confirmationStatus === 'confirmed') &&
          !processedEntities.current.has(discussion.id)
      );

      if (discussionsNeedingEntity.length > 0) {
        console.log(
          '[useSuggestionIdAssignment] Pass 2: Found',
          discussionsNeedingEntity.length,
          'discussions needing change_request entity'
        );

        for (const discussion of discussionsNeedingEntity) {
          const crId = discussion.crId;
          if (!crId) {
            continue;
          }

          const changeRequestEntityId = crypto.randomUUID();
          const index = updatedDiscussions.findIndex(d => d.id === discussion.id);

          if (index !== -1) {
            updatedDiscussions[index] = {
              ...updatedDiscussions[index],
              changeRequestEntityId,
            };
            processedEntities.current.add(discussion.id);
            hasChanges = true;

            console.log('[useSuggestionIdAssignment] Creating change_request entity:', {
              crId: discussion.crId,
              discussionId: discussion.id,
              changeRequestEntityId,
            });
            onChangeRequestCreate({
              crId,
              discussionId: discussion.id,
              changeRequestEntityId,
            });
          }
        }
      }
    }

    if (hasChanges) {
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
    assignMissingIds();
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
