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
  threads: any[];
  isLoading: any;
  hasMore: any;
  loadMore: any;
  createThread: any;
  createComment: any;
  voteOnThread: any;
  voteOnComment: any;
  loadMoreRef: any;
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
  threads,
  isLoading,
  hasMore,
  createThread,
  createComment,
  voteOnThread,
  voteOnComment,
  loadMoreRef,
}: DiscussionsPageContainerViewProps) {
  return (
    <DiscussionsView
      amendmentId={amendmentId}
      amendmentTitle={amendment?.title ?? undefined}
      authUserEmail={authUser?.email ?? undefined}
      hasMore={hasMore}
      hasAmendment={Boolean(amendment)}
      isCreateDialogOpen={isCreateDialogOpen}
      isLoading={isLoading}
      loadMoreRef={loadMoreRef}
      onCreateComment={createComment}
      onCreateDialogOpenChange={setIsCreateDialogOpen}
      onCreateThread={createThread}
      onSortByChange={setSortBy}
      onVoteComment={voteOnComment}
      onVoteThread={voteOnThread}
      sortBy={sortBy}
      threads={threads}
      userId={userId}
    />
  );
}
