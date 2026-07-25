import { FormControlTextarea } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';
import { MessageSquare } from 'lucide-react';
import { VirtualCommentChildren } from './CommentTreeView';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { useCallback, useState } from 'react';
import { DiscussionActionBar, DiscussionTimestamp } from '@/features/shared/ui/comments';
export interface ThreadCardViewProps {
  thread: any;
  userId: any;
  amendmentId: any;
  amendmentTitle: any;
  senderName: any;
  onCreateComment: any;
  onVoteThread: any;
  onVoteComment: any;
  isCommenting: any;
  setIsCommenting: any;
  commentText: any;
  setCommentText: any;
  isSubmitting: any;
  setIsSubmitting: any;
  createdCommentId?: string;
  isVoting?: boolean;
  score: any;
  userVote: any;
  hasUpvoted: any;
  hasDownvoted: any;
  sortedComments: any[];
  handleVote: any;
  handleAddComment: any;
}

export function ThreadCardView({
  thread,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteComment,
  isCommenting,
  setIsCommenting,
  commentText,
  setCommentText,
  isSubmitting,
  createdCommentId,
  isVoting,
  score,
  hasUpvoted,
  hasDownvoted,
  sortedComments,
  handleVote,
  handleAddComment,
}: ThreadCardViewProps) {
  const authorName =
    [thread.user?.first_name, thread.user?.last_name].filter(Boolean).join(' ') ||
    translateText('generated.inline.0056_anonymous_9bed5104');
  const [commentCount, setCommentCount] = useState(sortedComments.length);
  const handleCommentCountChange = useCallback((total: number) => setCommentCount(total), []);
  const [threadTitle = '', ...threadDescriptionParts] = String(thread.content ?? '').split('\n\n');
  const threadDescription = threadDescriptionParts.join('\n\n').trim();

  return (
    <section data-slot="discussion-thread" className="min-w-0 py-2">
      <article className="min-w-0 rounded-lg bg-[var(--surface)] p-3 shadow-none sm:p-4">
        <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <UserIdentityLink
            userId={thread.user?.id ?? thread.user_id}
            avatarUrl={thread.user?.avatar}
            name={authorName}
            fallbackLabel={authorName}
            avatarClassName="size-6"
            className="max-w-full"
            textContainerClassName="break-words [overflow-wrap:anywhere]"
          />
          <span className="hidden sm:inline">·</span>
          <DiscussionTimestamp value={thread.created_at} />
        </div>

        <h3 className="mt-2 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] break-words">
          {threadTitle}
        </h3>
        {threadDescription ? (
          <p className="mt-2 max-w-4xl text-sm leading-6 [overflow-wrap:anywhere] break-words whitespace-pre-wrap sm:text-base">
            {threadDescription}
          </p>
        ) : null}

        <DiscussionActionBar
          score={score}
          showVoting={Boolean(userId)}
          hasUpvoted={hasUpvoted}
          hasDownvoted={hasDownvoted}
          isVoting={isVoting}
          onUpvote={() => handleVote(1)}
          onDownvote={() => handleVote(-1)}
          className="mt-3"
        >
          <span className="flex h-7 items-center gap-1 px-1 text-xs font-medium">
            <MessageSquare className="size-3.5" />
            {commentCount} {translateText('generated.inline.0050_comment_118a9989')}
            {commentCount !== 1 ? 's' : ''}
          </span>
          {userId && !isCommenting ? (
            <Button
              variant="ghost"
              size="sm"
              presentation="mutedTiny"
              onClick={() => setIsCommenting(true)}
              className="h-7 px-2"
            >
              <MessageSquare className="size-3.5" />
              {translateText('generated.inline.0396_add_comment_d89450c8')}
            </Button>
          ) : null}
        </DiscussionActionBar>

        {userId && isCommenting ? (
          <div className="mt-3 max-w-2xl space-y-2">
            <FormControlTextarea
              placeholder={translateText('generated.inline.0397_write_your_comment_b1d820b5')}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={3}
              className="min-h-20"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={isSubmitting || !commentText.trim()}
              >
                {translateText('generated.inline.0398_post_comment_54cc0b90')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsCommenting(false)}>
                {translateText('generated.inline.0065_cancel_77dfd213')}
              </Button>
            </div>
          </div>
        ) : null}
      </article>

      <div className="mt-3">
        <VirtualCommentChildren
          threadId={thread.id}
          parentId={null}
          userId={userId}
          amendmentId={amendmentId}
          amendmentTitle={amendmentTitle}
          senderName={senderName}
          onCreateComment={onCreateComment}
          onVoteComment={onVoteComment}
          permalinkID={createdCommentId}
          onTotalChange={handleCommentCountChange}
          emptyContent={
            !isCommenting ? (
              <p className="text-muted-foreground py-3 text-sm">
                {translateText(
                  'generated.inline.0395_no_comments_yet_be_the_first_to_comment_ba5c0dff'
                )}
              </p>
            ) : null
          }
        />
      </div>
    </section>
  );
}
