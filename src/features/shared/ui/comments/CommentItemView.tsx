import type React from 'react';

import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Button } from '@/features/shared/ui/ui/button';
import { Reply, Trash2 } from 'lucide-react';
import { cn } from '@/features/shared/utils/utils';
import { CommentInput } from './CommentInput';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import type { CommentData } from './CommentItem';
import { DiscussionActionBar, DiscussionCollapseToggle } from './DiscussionActions';
import { DiscussionTimestamp } from './DiscussionTimestamp';

interface CommentItemViewProps {
  comment: CommentData;
  currentUserId?: string;
  onVote: (voteValue: number) => Promise<void>;
  onReply: (commentId: string, text: string) => Promise<void>;
  onReplySubmit: (text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  depth: number;
  showReplyInput: boolean;
  hasUpvoted: boolean;
  hasDownvoted: boolean;
  score: number;
  isOwner: boolean;
  isCollapsed: boolean;
  isVoting?: boolean;
  onToggleReplyInput: () => void;
  onCancelReply: () => void;
  onToggleCollapsed: () => void;
  linkAuthors?: boolean;
  renderReply: (reply: CommentData, depth: number) => React.ReactNode;
}

export function CommentItemView({
  comment,
  onVote,
  onReply,
  onReplySubmit,
  onDelete,
  depth,
  showReplyInput,
  hasUpvoted,
  hasDownvoted,
  score,
  isOwner,
  isCollapsed,
  isVoting,
  onToggleReplyInput,
  onCancelReply,
  onToggleCollapsed,
  linkAuthors,
  renderReply,
}: CommentItemViewProps) {
  void onReply;
  const creatorName =
    comment.creator?.name || translateText('generated.inline.0056_anonymous_9bed5104');

  return (
    <div
      data-slot="discussion-comment"
      className={cn(
        '-mx-2 flex min-w-0 gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]',
        depth > 0 && 'border-border/40 border-l pl-3'
      )}
    >
      <DiscussionCollapseToggle
        collapsed={isCollapsed}
        onToggle={onToggleCollapsed}
        className="mt-0.5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {linkAuthors ? (
            <UserIdentityLink
              userId={comment.creator?.id}
              avatarUrl={comment.creator?.avatar || comment.creator?.imageURL}
              name={creatorName}
              fallbackLabel={creatorName}
              handle={comment.creator?.handle}
              showHandle
              avatarClassName="h-5 w-5"
              fallbackClassName="text-[10px]"
              nameClassName="text-foreground font-medium"
              handleClassName="ml-2 hidden text-xs sm:inline"
            />
          ) : (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage src={comment.creator?.avatar || comment.creator?.imageURL} />
                <AvatarFallback className="text-[10px]">
                  {comment.creator?.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground font-medium">{creatorName}</span>
              {comment.creator?.handle ? (
                <span className="hidden text-xs sm:inline">@{comment.creator.handle}</span>
              ) : null}
            </>
          )}
          <span className="hidden sm:inline">·</span>
          <DiscussionTimestamp value={comment.createdAt} />
        </div>

        {!isCollapsed ? (
          <>
            <p className="mt-1 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
              {comment.text}
            </p>

            <DiscussionActionBar
              score={score}
              hasUpvoted={hasUpvoted}
              hasDownvoted={hasDownvoted}
              isVoting={isVoting}
              onUpvote={() => onVote(1)}
              onDownvote={() => onVote(-1)}
              className="mt-0.5"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                presentation="mutedTiny"
                onClick={onToggleReplyInput}
                className="h-7 px-2"
              >
                <Reply className="size-3.5" />
                {translateText('generated.inline.0377_reply_6c2bb735')}
              </Button>
              {isOwner && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  presentation="mutedTiny"
                  onClick={() => onDelete(comment.id)}
                  className="hover:text-destructive h-7 px-2"
                >
                  <Trash2 className="size-3.5" />
                  {translateText('generated.inline.0537_delete_f6fdbe48')}
                </Button>
              ) : null}
            </DiscussionActionBar>

            {showReplyInput ? (
              <CommentInput
                onSubmit={onReplySubmit}
                placeholder={translateText('generated.inline.1114_write_a_reply_126cd2cd')}
                replyTo={comment.creator?.name || 'this comment'}
                onCancelReply={onCancelReply}
                className="mt-2"
              />
            ) : null}

            {comment.replies && comment.replies.length > 0 ? (
              <div className="mt-1 space-y-1">
                {comment.replies.map((reply: any) => renderReply(reply, depth + 1))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
