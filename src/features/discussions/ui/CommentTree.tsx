import type { CommentWithReplies } from '../utils/comment-tree';

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
import { useCommentTreeController } from './useCommentTreeController';
import { CommentTreeView } from './CommentTreeView';

export function CommentTree({
  comment,
  threadId,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteComment,
}: CommentTreeProps) {
  const viewProps = useCommentTreeController({
    comment,
    threadId,
    userId,
    amendmentId,
    amendmentTitle,
    senderName,
    onCreateComment,
    onVoteComment,
  });

  return <CommentTreeView {...viewProps} />;
}
