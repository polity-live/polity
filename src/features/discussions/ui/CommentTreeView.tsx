import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { UserIdentityLink } from '@/features/shared/ui/UserIdentityLink';
import { Reply, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { CommentTree } from './CommentTree';
import { PolityZeroListView } from '@/features/shared/virtualization';
import { queries } from '@/zero/queries';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import type { ReactNode } from 'react';
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
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            {/* Vote buttons */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${hasUpvoted ? featureThemeClassName('discussionsCommentTreeWarningText') : ''}`}
                onClick={() => handleVote(1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <span
                className={`text-sm font-semibold ${score > 0 ? featureThemeClassName('discussionsCommentTreeWarningText') : score < 0 ? featureThemeClassName('discussionsCommentTreeInfoText') : ''}`}
              >
                {score}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${hasDownvoted ? featureThemeClassName('discussionsCommentTreeInfoText') : ''}`}
                onClick={() => handleVote(-1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Comment content */}
            <div className="flex-1">
              <div className="mb-3 flex items-start justify-between">
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <UserIdentityLink
                    userId={comment.user?.id ?? comment.user_id}
                    avatarUrl={comment.user?.avatar}
                    name={authorName}
                    fallbackLabel={authorName}
                    handle={comment.user?.handle}
                    showHandle
                    avatarClassName="h-6 w-6"
                    handleClassName="ml-2 text-xs"
                  />
                  <span>•</span>
                  <Clock className="h-4 w-4" />
                  <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="mb-3 whitespace-pre-wrap">{comment.content}</p>
              <Button variant="ghost" size="sm" onClick={() => setIsReplying(!isReplying)}>
                <Reply className="mr-2 h-4 w-4" />
                {translateText('generated.inline.0377_reply_6c2bb735')}
              </Button>

              {isReplying && (
                <div className="mt-4 space-y-2">
                  <FormControlTextarea
                    placeholder={translateText('generated.inline.0378_write_your_reply_fa39b3d9')}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleReply} disabled={isSubmitting || !replyText.trim()}>
                      {translateText('generated.inline.0379_post_reply_bb8ad002')}
                    </Button>
                    <Button variant="outline" onClick={() => setIsReplying(false)}>
                      {translateText('generated.inline.0065_cancel_77dfd213')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nested Replies */}
      <VirtualCommentChildren
        threadId={threadId}
        parentId={comment.id}
        userId={userId}
        amendmentId={amendmentId}
        amendmentTitle={amendmentTitle}
        senderName={senderName}
        onCreateComment={onCreateComment}
        onVoteComment={onVoteComment}
      />
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
  emptyContent?: ReactNode;
}) {
  const context = { threadId, parentId };
  return (
    <div className={parentId ? 'border-muted ml-8 border-l-2 pl-4' : undefined}>
      <PolityZeroListView<any, { created_at: number; id: string }, typeof context>
        context={context}
        historyKey={`discussion-${threadId}-comments-${parentId ?? 'root'}`}
        estimateSize={220}
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
        renderSkeleton={() => <Skeleton className="h-48 w-full rounded-xl" />}
        renderEmpty={() => emptyContent}
        contentClassName="space-y-3"
      />
    </div>
  );
}
