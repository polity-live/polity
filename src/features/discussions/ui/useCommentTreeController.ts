import { useRef, useState } from 'react';
import { toast } from '@/features/shared/ui/ui/sonner';
import { calculateScore } from '@/features/votes/utils/voting-utils';
import type { CommentWithReplies } from '../utils/comment-tree';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CommentTreeProps {
  comment: CommentWithReplies;
  threadId: string;
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
  onVoteComment: (
    commentId: string,
    voteValue: number,
    currentVote: { id: string; vote: number | null } | undefined,
    currentUpvotes: number,
    currentDownvotes: number,
    userId?: string
  ) => Promise<void>;
}
export function useCommentTreeController({
  comment,
  threadId,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteComment,
}: CommentTreeProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdReplyId, setCreatedReplyId] = useState<string>();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const votingRef = useRef(false);

  const score = calculateScore(comment.upvotes, comment.downvotes);
  const userVote = comment.votes?.find(v => v.user?.id === userId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;

  const handleVote = async (voteValue: number) => {
    if (votingRef.current) return;
    if (!userId) {
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }

    votingRef.current = true;
    setIsVoting(true);
    try {
      await onVoteComment(
        comment.id,
        voteValue,
        userVote,
        comment.upvotes || 0,
        comment.downvotes || 0,
        userId
      );
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(translateText('generated.inline.0140_failed_to_vote_68d9f4e2'));
    } finally {
      votingRef.current = false;
      setIsVoting(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      const replyId = await onCreateComment(threadId, replyText, userId, comment.id);
      setCreatedReplyId(replyId);
      setReplyText('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  return {
    comment,
    threadId,
    userId,
    amendmentId,
    amendmentTitle,
    senderName,
    onCreateComment,
    onVoteComment,
    isReplying,
    setIsReplying,
    replyText,
    setReplyText,
    isSubmitting,
    setIsSubmitting,
    createdReplyId,
    isCollapsed,
    isVoting,
    onToggleCollapsed: () => setIsCollapsed(collapsed => !collapsed),
    score,
    userVote,
    hasUpvoted,
    hasDownvoted,
    handleVote,
    handleReply,
  };
}
