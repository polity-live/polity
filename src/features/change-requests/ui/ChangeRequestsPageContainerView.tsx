import { ChangeRequestsView } from './ChangeRequestsView';
import { coerceDocumentContent } from '../logic/changeRequestsViewModel';
export interface ChangeRequestsPageContainerViewProps {
  amendmentId: any;
  userId: any;
  amendment: any;
  document: any;
  openChangeRequests: any;
  approvedChangeRequests: any;
  declinedChangeRequests: any;
  isLoading: any;
  agendaItemId: any;
  isInVotingStage: any;
  allChangeRequests: any;
  timelineItems: any;
  diffMap: any;
  discussions: any;
  branchSections: any;
  branchSelectorBranches: any;
  selectedBranchId: any;
  selectedBranchEditingMode: any;
  branchDiffCandidates: any;
  defaultBranchDiffRightCandidateId: any;
  onBranchChange: any;
  canManageInternalVotes: any;
  canVoteInternal: any;
  onCastInternalVote: any;
  onFinalizeInternalVote: any;
}

export function ChangeRequestsPageContainerView({
  amendmentId,
  userId,
  amendment,
  document,
  openChangeRequests,
  approvedChangeRequests,
  declinedChangeRequests,
  isLoading,
  agendaItemId,
  isInVotingStage,
  allChangeRequests,
  timelineItems,
  diffMap,
  discussions,
  branchSections,
  branchSelectorBranches,
  selectedBranchId,
  selectedBranchEditingMode,
  branchDiffCandidates,
  defaultBranchDiffRightCandidateId,
  onBranchChange,
  canManageInternalVotes,
  canVoteInternal,
  onCastInternalVote,
  onFinalizeInternalVote,
}: ChangeRequestsPageContainerViewProps) {
  return (
    <ChangeRequestsView
      amendmentId={amendmentId}
      approvedCount={approvedChangeRequests.length}
      declinedCount={declinedChangeRequests.length}
      openCount={openChangeRequests.length}
      allChangeRequestsCount={allChangeRequests.length}
      agendaItemId={agendaItemId ?? undefined}
      diffMap={diffMap}
      discussions={discussions}
      documentContent={coerceDocumentContent(document?.content)}
      editingMode={selectedBranchEditingMode}
      hasAmendment={Boolean(amendment)}
      isInVotingStage={isInVotingStage}
      isLoading={isLoading}
      timelineItems={timelineItems}
      branchSections={branchSections}
      branchSelectorBranches={branchSelectorBranches}
      selectedBranchId={selectedBranchId}
      branchDiffCandidates={branchDiffCandidates}
      defaultBranchDiffRightCandidateId={defaultBranchDiffRightCandidateId}
      onBranchChange={onBranchChange}
      userId={userId}
      canManageInternalVotes={canManageInternalVotes}
      canVoteInternal={canVoteInternal}
      onCastInternalVote={onCastInternalVote}
      onFinalizeInternalVote={onFinalizeInternalVote}
    />
  );
}
