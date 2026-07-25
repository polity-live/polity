import { FormControlTextarea } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';
import { Reply } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { CommentTree } from './CommentTree';
import {
  DiscussionActionBar,
  DiscussionCollapseToggle,
  DiscussionTimestamp,
} from '@/features/shared/ui/comments';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { useMemo, type ReactNode } from 'react';
export interface CommentTreeViewProps {
  comment: { replies?: any[]; [key: string]: any };
  threadId: any;
  userId: any;
  amendmentId: any;
  amendmentTitle: any;
  senderName: any;
  onCreateComment: any;
  onVoteComment: any;
  isReplying: any;
  setIsReplying: any;
  replyText: any;
  setReplyText: any;
  isSubmitting: any;
  setIsSubmitting: any;
  createdReplyId?: string;
  isCollapsed: boolean;
  isVoting?: boolean;
  onToggleCollapsed: () => void;
  score: any;
  userVote: any;
  hasUpvoted: any;
  hasDownvoted: any;
  handleVote: any;
  handleReply: any;
}

export function CommentTreeView({
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
  createdReplyId,
  isCollapsed,
  isVoting,
  onToggleCollapsed,
  score,
  hasUpvoted,
  hasDownvoted,
  handleVote,
  handleReply,
}: CommentTreeViewProps) {
  const authorName =
    [comment.user?.first_name, comment.user?.last_name].filter(Boolean).join(' ') ||
    translateText('generated.inline.0056_anonymous_9bed5104');

  return (
    <div data-slot="discussion-comment" className="space-y-1">
      <article className="-mx-2 flex min-w-0 gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface)]">
        <DiscussionCollapseToggle
          collapsed={isCollapsed}
          onToggle={onToggleCollapsed}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <UserIdentityLink
              userId={comment.user?.id ?? comment.user_id}
              avatarUrl={comment.user?.avatar}
              name={authorName}
              fallbackLabel={authorName}
              handle={comment.user?.handle}
              showHandle
              avatarClassName="size-5"
              handleClassName="ml-1.5 hidden text-xs sm:inline"
              className="max-w-full"
              textContainerClassName="break-words [overflow-wrap:anywhere]"
            />
            <span className="hidden sm:inline">·</span>
            <DiscussionTimestamp value={comment.created_at} />
          </div>

          {!isCollapsed ? (
            <>
              <p className="mt-1 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {comment.content}
              </p>

              <DiscussionActionBar
                score={score}
                showVoting={Boolean(userId)}
                hasUpvoted={hasUpvoted}
                hasDownvoted={hasDownvoted}
                isVoting={isVoting}
                onUpvote={() => handleVote(1)}
                onDownvote={() => handleVote(-1)}
              >
                {userId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    presentation="mutedTiny"
                    className="h-7 px-2"
                    onClick={() => setIsReplying(!isReplying)}
                  >
                    <Reply className="size-3.5" />
                    {translateText('generated.inline.0377_reply_6c2bb735')}
                  </Button>
                ) : null}
              </DiscussionActionBar>

              {userId && isReplying ? (
                <div className="mt-2 max-w-2xl space-y-2">
                  <FormControlTextarea
                    placeholder={translateText('generated.inline.0378_write_your_reply_fa39b3d9')}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={3}
                    className="min-h-20"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleReply}
                      disabled={isSubmitting || !replyText.trim()}
                    >
                      {translateText('generated.inline.0379_post_reply_bb8ad002')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsReplying(false)}>
                      {translateText('generated.inline.0065_cancel_77dfd213')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </article>

      {/* Nested Replies */}
      {!isCollapsed ? (
        <VirtualCommentChildren
          threadId={threadId}
          parentId={comment.id}
          userId={userId}
          amendmentId={amendmentId}
          amendmentTitle={amendmentTitle}
          senderName={senderName}
          onCreateComment={onCreateComment}
          onVoteComment={onVoteComment}
          permalinkID={createdReplyId}
        />
      ) : null}
    </div>
  );
}

export function VirtualCommentChildren({
  threadId,
  parentId,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteComment,
  permalinkID,
  onTotalChange,
  emptyContent = null,
}: {
  threadId: string;
  parentId: string | null;
  userId?: string;
  amendmentId?: string;
  amendmentTitle?: string;
  senderName?: string;
  onCreateComment: any;
  onVoteComment: any;
  permalinkID?: string;
  onTotalChange?: (total: number) => void;
  emptyContent?: ReactNode;
}) {
  const context = useMemo(() => ({ threadId, parentId }), [parentId, threadId]);
  return (
    <div className={parentId ? 'border-border/40 ml-2 border-l pl-3 sm:ml-3 sm:pl-4' : undefined}>
      <PolityZeroListView<any, { created_at: number; id: string }, typeof context>
        context={context}
        historyKey={`discussion-${threadId}-comments-${parentId ?? 'root'}`}
        estimateSize={120}
        windowScroll
        getRowKey={comment => comment.id}
        toStartRow={comment => ({ created_at: comment.created_at, id: comment.id })}
        getPageQuery={({ limit, start, dir, settled }) => ({
          query: queries.amendments.discussionCommentPage({
            threadId,
            parentId,
            limit,
            start,
            dir,
          }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        getSingleQuery={({ id, settled }) => ({
          query: queries.amendments.discussionCommentById({ id }) as never,
          options: { ttl: settled ? ('5m' as const) : ('none' as const) },
        })}
        permalinkID={permalinkID}
        onTotalChange={onTotalChange}
        renderRow={comment => (
          <CommentTree
            comment={comment}
            threadId={threadId}
            userId={userId}
            amendmentId={amendmentId}
            amendmentTitle={amendmentTitle}
            senderName={senderName}
            onCreateComment={onCreateComment}
            onVoteComment={onVoteComment}
          />
        )}
        renderSkeleton={() => <Skeleton className="h-24 w-full rounded-md" />}
        renderEmpty={() => emptyContent}
        contentClassName="space-y-1"
      />
    </div>
  );
}
