'use client';

import type { ReactNode } from 'react';

import { MessageSquare } from 'lucide-react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

import { CommentInput } from './CommentInput';
import { CommentItem, type CommentData } from './CommentItem';
import { CommentSortSelect, type CommentSortBy } from './CommentSortSelect';

interface CommentThreadViewProps {
  comments: CommentData[];
  threadedComments: CommentData[];
  currentUserId?: string;
  onVote: (
    commentId: string,
    voteValue: number,
    existingVote?: { id: string; vote: number }
  ) => Promise<void>;
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  hideHeader?: boolean;
  sortBy: CommentSortBy;
  onSortChange: (sortBy: CommentSortBy) => void;
  emptyState?: ReactNode;
  isSubmitting?: boolean;
  isCommenting: boolean;
  setIsCommenting: (open: boolean) => void;
  onAddRootComment: (text: string) => Promise<void>;
  linkAuthors?: boolean;
  className?: string;
}

export function CommentThreadView({
  comments,
  threadedComments,
  currentUserId,
  onVote,
  onReply,
  onDelete,
  hideHeader,
  sortBy,
  onSortChange,
  emptyState,
  isSubmitting,
  isCommenting,
  setIsCommenting,
  onAddRootComment,
  linkAuthors,
  className,
}: CommentThreadViewProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        {!hideHeader && (
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            <span>
              {comments.length} {translateText('generated.inline.0909_comments_fce06e20')}
            </span>
          </div>
        )}
        <CommentSortSelect sortBy={sortBy} onSortChange={onSortChange} className="w-36" />
      </div>

      {currentUserId && !isCommenting ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          presentation="mutedTiny"
          className="h-7 px-2"
          onClick={() => setIsCommenting(true)}
        >
          <MessageSquare className="size-3.5" />
          {translateText('generated.inline.0396_add_comment_d89450c8')}
        </Button>
      ) : null}

      {currentUserId && isCommenting ? (
        <CommentInput
          onSubmit={onAddRootComment}
          placeholder={translateText('generated.inline.1115_add_a_comment_2339bc47')}
          isSubmitting={isSubmitting}
          onCancelReply={() => setIsCommenting(false)}
        />
      ) : null}

      <div data-slot="discussion-comment-list" className="space-y-1">
        {threadedComments.length === 0
          ? (emptyState ?? (
              <p className="text-muted-foreground py-4 text-sm">
                {translateText(
                  'generated.inline.0395_no_comments_yet_be_the_first_to_comment_ba5c0dff'
                )}
              </p>
            ))
          : threadedComments.map((comment: any) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onVote={onVote}
                onReply={onReply}
                onDelete={onDelete}
                linkAuthors={linkAuthors}
              />
            ))}
      </div>
    </div>
  );
}
