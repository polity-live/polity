import type { Thread } from '../hooks/useDiscussions';

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
import { useThreadCardController } from './useThreadCardController';
import { ThreadCardView } from './ThreadCardView';

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
  const viewProps = useThreadCardController({
    thread,
    userId,
    amendmentId,
    amendmentTitle,
    senderName,
    onCreateComment,
    onVoteThread,
    onVoteComment,
  });

  return <ThreadCardView {...viewProps} />;
}
