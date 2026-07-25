import { useRef, useState } from 'react';

import type { CommentData } from '@/features/shared/ui/comments/CommentItem';

export function useCommentItemController(args: {
  comment: CommentData;
  currentUserId?: string;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
  onReply: (commentId: string, text: string) => Promise<void>;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const votingRef = useRef(false);

  const userVote = args.comment.votes?.find(vote => vote.user?.id === args.currentUserId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;
  const upvotes =
    args.comment.upvotes ?? args.comment.votes?.filter(vote => vote.vote === 1).length ?? 0;
  const downvotes =
    args.comment.downvotes ?? args.comment.votes?.filter(vote => vote.vote === -1).length ?? 0;
  const score = upvotes - downvotes;
  const isOwner = Boolean(args.currentUserId && args.comment.creator?.id === args.currentUserId);

  const handleVote = async (voteValue: number) => {
    if (votingRef.current) return;
    votingRef.current = true;
    setIsVoting(true);
    try {
      await args.onVote(
        args.comment.id,
        voteValue,
        userVote ? { id: userVote.id, vote: userVote.vote } : undefined
      );
    } finally {
      votingRef.current = false;
      setIsVoting(false);
    }
  };

  const handleReply = async (text: string) => {
    await args.onReply(args.comment.id, text);
    setShowReplyInput(false);
  };

  return {
    showReplyInput,
    hasUpvoted,
    hasDownvoted,
    score,
    isOwner,
    isCollapsed,
    isVoting,
    onVote: handleVote,
    onReplySubmit: handleReply,
    onToggleReplyInput: () => setShowReplyInput(current => !current),
    onCancelReply: () => setShowReplyInput(false),
    onToggleCollapsed: () => {
      setShowReplyInput(false);
      setIsCollapsed(collapsed => !collapsed);
    },
  };
}
