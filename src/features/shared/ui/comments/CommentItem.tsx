'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { ArrowUp, ArrowDown, Clock, Reply, Trash2 } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { useState } from 'react';
import { CommentInput } from './CommentInput';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

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
}

export function CommentItem({
  comment,
  currentUserId,
  onVote,
  onReply,
  onDelete,
  depth = 0,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);

  const userVote = comment.votes?.find(v => v.user?.id === currentUserId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;

  const upvotes = comment.votes?.filter(v => v.vote === 1).length || 0;
  const downvotes = comment.votes?.filter(v => v.vote === -1).length || 0;
  const score = upvotes - downvotes;

  const isOwner = currentUserId && comment.creator?.id === currentUserId;

  const handleVote = async (voteValue: number) => {
    await onVote(
      comment.id,
      voteValue,
      userVote ? { id: userVote.id, vote: userVote.vote } : undefined
    );
  };

  const handleReply = async (text: string) => {
    await onReply(comment.id, text);
    setShowReplyInput(false);
  };

  return (
    <div className={cn('flex gap-3', depth > 0 && 'border-l-2 pl-4')}>
      {/* Vote column */}
      <div className="flex flex-col items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', hasUpvoted && 'text-orange-500')}
          onClick={() => handleVote(1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <span
          className={cn(
            'text-xs font-semibold',
            score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : 'text-muted-foreground'
          )}
        >
          {score}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', hasDownvoted && 'text-blue-500')}
          onClick={() => handleVote(-1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Avatar className="h-5 w-5">
            <AvatarImage src={comment.creator?.avatar || comment.creator?.imageURL} />
            <AvatarFallback className="text-[10px]">
              {comment.creator?.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-foreground font-medium">
            {comment.creator?.name || translateText('generated.inline.0056_anonymous_9bed5104')}
          </span>
          {comment.creator?.handle && <span className="text-xs">@{comment.creator.handle}</span>}
          <span>·</span>
          <span className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>

        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.text}</p>

        {/* Actions */}
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
          >
            <Reply className="h-3 w-3" />
            {translateText('generated.inline.0377_reply_6c2bb735')}
          </button>
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs"
            >
              <Trash2 className="h-3 w-3" />
              {translateText('generated.inline.0537_delete_f6fdbe48')}
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <CommentInput
            onSubmit={handleReply}
            placeholder={translateText('generated.inline.1114_write_a_reply_126cd2cd')}
            replyTo={comment.creator?.name || 'this comment'}
            onCancelReply={() => setShowReplyInput(false)}
            className="mt-2"
          />
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onVote={onVote}
                onReply={onReply}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
