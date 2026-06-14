import { featureThemeClassName } from '@/features/shared/theme';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { Reply, ArrowUp, ArrowDown, Clock } from 'lucide-react';
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
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const score = calculateScore(comment.upvotes, comment.downvotes);
  const userVote = comment.votes?.find(v => v.user?.id === userId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;

  const handleVote = async (voteValue: number) => {
    if (!userId) {
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }

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
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      await onCreateComment(threadId, replyText, userId, comment.id);
      setReplyText('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.user?.avatar ?? undefined} />
                    <AvatarFallback>
                      {comment.user?.first_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {[comment.user?.first_name, comment.user?.last_name]
                      .filter(Boolean)
                      .join(' ') || translateText('generated.inline.0056_anonymous_9bed5104')}
                  </span>
                  {comment.user?.handle && <span className="text-xs">@{comment.user.handle}</span>}
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
      {comment.replies && comment.replies.length > 0 && (
        <div className="border-muted ml-8 space-y-3 border-l-2 pl-4">
          {comment.replies.map(reply => (
            <CommentTree
              key={reply.id}
              comment={reply}
              threadId={threadId}
              userId={userId}
              amendmentId={amendmentId}
              amendmentTitle={amendmentTitle}
              senderName={senderName}
              onCreateComment={onCreateComment}
              onVoteComment={onVoteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
