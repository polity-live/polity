import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useDocumentActions } from '@/zero/documents/useDocumentActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import type { CommentData } from '@/features/shared/ui/comments/CommentItem';

interface DiscussionVote {
  id: string;
  vote?: number | null;
  user?: { id: string } | null;
}

interface DiscussionUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  handle?: string | null;
  avatar?: string | null;
}

interface DiscussionComment {
  id: string;
  content?: string | null;
  parent_id?: string | null;
  created_at: number;
  user?: DiscussionUser | null;
  votes?: readonly DiscussionVote[];
  replies?: readonly DiscussionComment[];
}

interface TodoDiscussionSource {
  threads?: readonly {
    id: string;
    comments?: readonly DiscussionComment[];
  }[];
}

export interface TodoDiscussionController {
  comments: CommentData[];
  commentCount: number;
  currentUserId?: string;
  isSubmitting: boolean;
  onAddComment: (text: string, parentId?: string) => Promise<void>;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
}

function mapComment(comment: DiscussionComment): CommentData {
  const displayName = comment.user
    ? `${comment.user.first_name ?? ''} ${comment.user.last_name ?? ''}`.trim() ||
      comment.user.handle ||
      'Unknown'
    : undefined;

  return {
    id: comment.id,
    text: comment.content ?? '',
    parent_id: comment.parent_id ?? null,
    createdAt: comment.created_at,
    creator: comment.user
      ? {
          id: comment.user.id,
          name: displayName,
          handle: comment.user.handle ?? undefined,
          avatar: comment.user.avatar ?? undefined,
        }
      : undefined,
    votes: (comment.votes ?? []).map(vote => ({
      id: vote.id,
      vote: vote.vote ?? 0,
      user: vote.user ? { id: vote.user.id } : undefined,
    })),
    replies: (comment.replies ?? []).map(mapComment),
  };
}

function countComments(comments: readonly DiscussionComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies ?? []), 0);
}

export function useTodoDiscussion(todo?: TodoDiscussionSource | null): TodoDiscussionController {
  const { user } = useAuth();
  const { addComment, voteComment, updateCommentVote, deleteCommentVote } = useDocumentActions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const thread = todo?.threads?.[0] ?? null;
  const rawComments = thread?.comments ?? [];

  const topLevelComments = useMemo(
    () => rawComments.filter(comment => !comment.parent_id),
    [rawComments]
  );
  const comments = useMemo(() => topLevelComments.map(mapComment), [topLevelComments]);
  const commentCount = useMemo(() => countComments(topLevelComments), [topLevelComments]);

  const onAddComment = useCallback(
    async (text: string, parentId?: string) => {
      if (!user?.id || !thread || !text.trim()) return;

      setIsSubmitting(true);
      try {
        await waitForClientApply(
          addComment({
            id: crypto.randomUUID(),
            thread_id: thread.id,
            user_id: user.id,
            parent_id: parentId ?? null,
            content: text.trim(),
            upvotes: 0,
            downvotes: 0,
          })
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [addComment, thread, user?.id]
  );

  const onVote = useCallback(
    async (commentId: string, voteValue: number, existingVote?: { id: string; vote: number }) => {
      if (!user?.id) return;

      if (existingVote?.vote === voteValue) {
        await waitForClientApply(deleteCommentVote(existingVote.id));
        return;
      }
      if (existingVote) {
        await waitForClientApply(updateCommentVote({ id: existingVote.id, vote: voteValue }));
        return;
      }

      await waitForClientApply(
        voteComment({
          id: crypto.randomUUID(),
          comment_id: commentId,
          user_id: user.id,
          vote: voteValue,
        })
      );
    },
    [deleteCommentVote, updateCommentVote, user?.id, voteComment]
  );

  return {
    comments,
    commentCount,
    currentUserId: thread ? user?.id : undefined,
    isSubmitting,
    onAddComment,
    onVote,
  };
}
