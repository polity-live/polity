import { featureThemeClassName } from '@/features/shared/theme';
import { BadgeControl } from '@/features/shared/ui/status';
import { FormControlTextarea } from '@/features/shared/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/shared/ui/ui/avatar';
import { ArrowUp, ArrowDown, Clock, MessageSquare } from 'lucide-react';
import { CommentTree } from './CommentTree';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
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
  score,
  hasUpvoted,
  hasDownvoted,
  sortedComments,
  handleVote,
  handleAddComment,
}: ThreadCardViewProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex gap-4">
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
                <BadgeControl variant="outline">
                  {sortedComments.length}
                  {translateText('generated.inline.0050_comment_118a9989')}
                  {sortedComments.length !== 1 ? 's' : ''}
                </BadgeControl>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Comments */}
        <div className="space-y-4">
          {sortedComments.map((comment: any) => (
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
              <FormControlTextarea
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
