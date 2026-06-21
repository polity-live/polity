'use client';

import { useCommentItemController } from '@/features/shared/hooks/useCommentItemController';

import { CommentItemView } from './CommentItemView';

export interface CommentData {
  id: string;
  text: string;
  createdAt: number;
  parent_id?: string | null;
  creator?: {
    id?: string;
    name?: string;
    handle?: string;
    avatar?: string;
    imageURL?: string;
  };
  votes?: {
    id: string;
    vote: number;
    user?: { id: string };
  }[];
  replies?: CommentData[];
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId?: string;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
  onReply: (commentId: string, text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  depth?: number;
  linkAuthors?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onVote,
  onReply,
  onDelete,
  depth = 0,
  linkAuthors,
}: CommentItemProps) {
  const controller = useCommentItemController({
    comment,
    currentUserId,
    onVote,
    onReply,
  });

  return (
    <CommentItemView
      comment={comment}
      currentUserId={currentUserId}
      onReply={onReply}
      onDelete={onDelete}
      depth={depth}
      linkAuthors={linkAuthors}
      renderReply={(reply, replyDepth) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          onVote={onVote}
          onReply={onReply}
          onDelete={onDelete}
          depth={replyDepth}
          linkAuthors={linkAuthors}
        />
      )}
      {...controller}
    />
  );
}
