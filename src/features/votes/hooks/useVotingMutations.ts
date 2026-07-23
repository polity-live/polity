import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useCallback } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useDocumentActions } from '@/zero/documents';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

/**
 * Orchestration hook that replaces the Supabase-based voteOnThread / voteOnComment
 * utilities with Zero mutators.
 *
 * Composes:
 *  - voteThread / updateThreadVote / deleteThreadVote / updateThread
 *  - voteComment / updateCommentVote / deleteCommentVote / updateComment
 */
export function useVotingMutations() {
  const actions = useDocumentActions();

  const voteOnThread = useCallback(
    async (
      threadId: string,
      voteValue: number,
      currentVote: { id: string; vote?: number | null } | undefined,
      _currentUpvotes = 0,
      _currentDownvotes = 0,
      userId?: string
    ) => {
      if (!userId) {
        toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
        return;
      }

      try {
        if (currentVote) {
          if (currentVote.vote === voteValue) {
            // Same vote → remove
            await waitForClientApply(actions.deleteThreadVote(currentVote.id));
          } else {
            // Different vote → change
            await waitForClientApply(
              actions.updateThreadVote({ id: currentVote.id, vote: voteValue })
            );
          }
        } else {
          // New vote → insert
          await waitForClientApply(
            actions.voteThread({
              id: crypto.randomUUID(),
              vote: voteValue,
              thread_id: threadId,
              user_id: userId,
            })
          );
        }
      } catch (error) {
        console.error('Error voting on thread:', error);
        throw error;
      }
    },
    [actions]
  );

  const voteOnComment = useCallback(
    async (
      commentId: string,
      voteValue: number,
      currentVote: { id: string; vote: number | null } | undefined,
      _currentUpvotes = 0,
      _currentDownvotes = 0,
      userId?: string
    ) => {
      if (!userId) {
        toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
        return;
      }

      try {
        if (currentVote) {
          if (currentVote.vote === voteValue) {
            // Same vote → remove
            await waitForClientApply(actions.deleteCommentVote(currentVote.id));
          } else {
            // Different vote → change
            await waitForClientApply(
              actions.updateCommentVote({ id: currentVote.id, vote: voteValue })
            );
          }
        } else {
          // New vote → insert
          await waitForClientApply(
            actions.voteComment({
              id: crypto.randomUUID(),
              vote: voteValue,
              comment_id: commentId,
              user_id: userId,
            })
          );
        }
      } catch (error) {
        console.error('Error voting on comment:', error);
        throw error;
      }
    },
    [actions]
  );

  return { voteOnThread, voteOnComment };
}
