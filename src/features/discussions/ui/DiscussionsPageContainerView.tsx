import { DiscussionsView } from './DiscussionsView';
export interface DiscussionsPageContainerViewProps {
  amendmentId: any;
  userId: any;
  isCreateDialogOpen: any;
  setIsCreateDialogOpen: any;
  sortBy: any;
  setSortBy: any;
  authUser: any;
  amendment: any;
  isLoading: any;
  createThread: any;
  createComment: any;
  voteOnThread: any;
  voteOnComment: any;
}

export function DiscussionsPageContainerView({
  amendmentId,
  userId,
  isCreateDialogOpen,
  setIsCreateDialogOpen,
  sortBy,
  setSortBy,
  authUser,
  amendment,
  isLoading,
  createThread,
  createComment,
  voteOnThread,
  voteOnComment,
}: DiscussionsPageContainerViewProps) {
  return (
    <DiscussionsView
      amendmentId={amendmentId}
      amendmentTitle={amendment?.title ?? undefined}
      authUserEmail={authUser?.email ?? undefined}
      hasAmendment={Boolean(amendment)}
      isCreateDialogOpen={isCreateDialogOpen}
      isLoading={isLoading}
      onCreateComment={createComment}
      onCreateDialogOpenChange={setIsCreateDialogOpen}
      onCreateThread={createThread}
      onSortByChange={setSortBy}
      onVoteComment={voteOnComment}
      onVoteThread={voteOnThread}
      sortBy={sortBy}
      userId={userId}
    />
  );
}
