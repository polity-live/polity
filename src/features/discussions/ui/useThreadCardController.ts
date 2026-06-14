import { useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { calculateScore } from '@/features/votes/utils/voting-utils';
import type { Thread } from '../hooks/useDiscussions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ThreadCardProps {
  thread: Thread;
  userId?: string;
  amendmentId?: string;
  amendmentTitle?: string;
  senderName?: string;
  onCreateComment: (
    threadId: string,
    text: string,
    userId: string,
    parentCommentId?: string
  ) => Promise<string>;
  onVoteThread: (
    threadId: string,
    voteValue: number,
    currentVote: { id: string; vote?: number | null } | undefined,
    currentUpvotes: number,
    currentDownvotes: number,
    userId?: string
  ) => Promise<void>;
  onVoteComment: (
    commentId: string,
    voteValue: number,
    currentVote: { id: string; vote: number | null } | undefined,
    currentUpvotes: number,
    currentDownvotes: number,
    userId?: string
  ) => Promise<void>;
}
export function useThreadCardController({
  thread,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteThread,
  onVoteComment,
}: ThreadCardProps) {
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const score = calculateScore(thread.upvotes, thread.downvotes);
  const userVote = thread.votes?.find(v => v.user?.id === userId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;

  const sortedComments = thread.comments || [];

  const handleVote = async (voteValue: number) => {
    if (!userId) {
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }

    try {
      await onVoteThread(
        thread.id,
        voteValue,
        userVote,
        thread.upvotes || 0,
        thread.downvotes || 0,
        userId
      );
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(translateText('generated.inline.0140_failed_to_vote_68d9f4e2'));
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      await onCreateComment(thread.id, commentText, userId, undefined);
      setCommentText('');
      setIsCommenting(false);
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  return {
    thread,
    userId,
    amendmentId,
    amendmentTitle,
    senderName,
    onCreateComment,
    onVoteThread,
    onVoteComment,
    isCommenting,
    setIsCommenting,
    commentText,
    setCommentText,
    isSubmitting,
    setIsSubmitting,
    score,
    userVote,
    hasUpvoted,
    hasDownvoted,
    sortedComments,
    handleVote,
    handleAddComment,
  };
}
