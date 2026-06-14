import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Badge } from '@/features/shared/ui/ui/badge';
import { Button } from '@/features/shared/ui/ui/button';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { ArrowUp, ArrowDown, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { calculateScore } from '@/features/votes/utils/voting-utils';
import { CommentTree } from './CommentTree';
import type { Thread } from '../hooks/useDiscussions';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface ThreadCardProps {
  thread: Thread;
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
  onVoteThread: (
    threadId: string,
    voteValue: number,
    currentVote: { id: string; vote?: number | null } | undefined,
    currentUpvotes: number,
    currentDownvotes: number,
    userId?: string
  ) => Promise<void>;
  onVoteComment: (
    commentId: string,
    voteValue: number,
    currentVote: { id: string; vote: number | null } | undefined,
    currentUpvotes: number,
    currentDownvotes: number,
    userId?: string
  ) => Promise<void>;
}

export function ThreadCard({
  thread,
  userId,
  amendmentId,
  amendmentTitle,
  senderName,
  onCreateComment,
  onVoteThread,
  onVoteComment,
}: ThreadCardProps) {
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const score = calculateScore(thread.upvotes, thread.downvotes);
  const userVote = thread.votes?.find(v => v.user?.id === userId);
  const hasUpvoted = userVote?.vote === 1;
  const hasDownvoted = userVote?.vote === -1;

  const sortedComments = thread.comments || [];

  const handleVote = async (voteValue: number) => {
    if (!userId) {
      toast.error(translateText('generated.inline.0138_please_log_in_to_vote_59574e84'));
      return;
    }

    try {
      await onVoteThread(
        thread.id,
        voteValue,
        userVote,
        thread.upvotes || 0,
        thread.downvotes || 0,
        userId
      );
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(translateText('generated.inline.0140_failed_to_vote_68d9f4e2'));
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      await onCreateComment(thread.id, commentText, userId, undefined);
      setCommentText('');
      setIsCommenting(false);
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex gap-4">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${hasUpvoted ? 'text-orange-500' : ''}`}
              onClick={() => handleVote(1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <span
              className={`text-sm font-semibold ${score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : ''}`}
            >
              {score}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 w-8 p-0 ${hasDownvoted ? 'text-blue-500' : ''}`}
              onClick={() => handleVote(-1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Thread content */}
          <div className="flex flex-1 items-start justify-between">
            <div className="flex-1">
              <CardTitle className="mb-2">{thread.content}</CardTitle>
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={thread.user?.avatar ?? undefined} />
                    <AvatarFallback>
                      {thread.user?.first_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {[thread.user?.first_name, thread.user?.last_name].filter(Boolean).join(' ') ||
                      translateText('generated.inline.0056_anonymous_9bed5104')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                </div>
                <Badge variant="outline">
                  {sortedComments.length}
                  {translateText('generated.inline.0050_comment_118a9989')}
                  {sortedComments.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Comments */}
        <div className="space-y-4">
          {sortedComments.map(comment => (
            <CommentTree
              key={comment.id}
              comment={comment}
              threadId={thread.id}
              userId={userId}
              amendmentId={amendmentId}
              amendmentTitle={amendmentTitle}
              senderName={senderName}
              onCreateComment={onCreateComment}
              onVoteComment={onVoteComment}
            />
          ))}

          {sortedComments.length === 0 && !isCommenting && (
            <p className="text-muted-foreground text-center text-sm">
              {translateText(
                'generated.inline.0395_no_comments_yet_be_the_first_to_comment_ba5c0dff'
              )}
            </p>
          )}

          {/* Add Comment */}
          {!isCommenting && (
            <Button variant="outline" onClick={() => setIsCommenting(true)} className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0396_add_comment_d89450c8')}
            </Button>
          )}

          {isCommenting && (
            <div className="space-y-2 rounded-lg border p-4">
              <Textarea
                placeholder={translateText('generated.inline.0397_write_your_comment_b1d820b5')}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddComment} disabled={isSubmitting || !commentText.trim()}>
                  {translateText('generated.inline.0398_post_comment_54cc0b90')}
                </Button>
                <Button variant="outline" onClick={() => setIsCommenting(false)}>
                  {translateText('generated.inline.0065_cancel_77dfd213')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
