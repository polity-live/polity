import { ChangeRequestsView } from './ChangeRequestsView';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import type { EditingMode } from '@/zero/amendments/editing-mode-policy';
export interface ChangeRequestsPageContainerViewProps {
  amendmentId: any;
  userId: any;
  amendment: any;
  document: any;
  streetDesigns?: any;
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
  obsoleteBranchSections: any;
  obsoleteTimelineItems: any;
  obsoleteDiffMap: any;
  branchSelectorBranches: any;
  selectedBranchId: any;
  selectedBranchEditingMode: EditingMode;
  branchDiffCandidates: any;
  defaultBranchDiffRightCandidateId: any;
  onBranchChange: any;
  canManageInternalVotes: any;
  canVoteInternal: any;
  canVoteEvent: any;
  hasUserVotedOnEventCR: any;
  getEventCRSelectedChoiceIds: any;
  onCastEventCRVote: any;
  onOpenEventCRVoteDialog: any;
  eventVoteDialogOpen: any;
  setEventVoteDialogOpen: any;
  selectedEventVoteTitle: any;
  selectedEventVoteChoices: any;
  selectedEventVotePhase: any;
  onCastEventVoteFromDialog: any;
  onSubmitVotingPassword: any;
  passwordError: any;
  isPasswordVerifying: any;
  onCastInternalVote: any;
  onFinalizeInternalVote: any;
}

export function ChangeRequestsPageContainerView({
  amendmentId,
  userId,
  amendment,
  document,
  streetDesigns = [],
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
  obsoleteBranchSections,
  obsoleteTimelineItems,
  obsoleteDiffMap,
  branchSelectorBranches,
  selectedBranchId,
  selectedBranchEditingMode,
  branchDiffCandidates,
  defaultBranchDiffRightCandidateId,
  onBranchChange,
  canManageInternalVotes,
  canVoteInternal,
  canVoteEvent,
  hasUserVotedOnEventCR,
  getEventCRSelectedChoiceIds,
  onCastEventCRVote,
  onOpenEventCRVoteDialog,
  eventVoteDialogOpen,
  setEventVoteDialogOpen,
  selectedEventVoteTitle,
  selectedEventVoteChoices,
  selectedEventVotePhase,
  onCastEventVoteFromDialog,
  onSubmitVotingPassword,
  passwordError,
  isPasswordVerifying,
  onCastInternalVote,
  onFinalizeInternalVote,
}: ChangeRequestsPageContainerViewProps) {
  return (
    <>
      <ChangeRequestsView
        virtualize
        amendmentId={amendmentId}
        approvedCount={approvedChangeRequests.length}
        declinedCount={declinedChangeRequests.length}
        openCount={openChangeRequests.length}
        allChangeRequestsCount={allChangeRequests.length}
        agendaItemId={agendaItemId ?? undefined}
        diffMap={diffMap}
        discussions={discussions}
        documentContent={document?.content}
        streetDesigns={streetDesigns}
        editingMode={selectedBranchEditingMode}
        hasAmendment={Boolean(amendment)}
        isInVotingStage={isInVotingStage}
        isLoading={isLoading}
        timelineItems={timelineItems}
        obsoleteTimelineItems={obsoleteTimelineItems}
        obsoleteDiffMap={obsoleteDiffMap}
        branchSections={branchSections}
        obsoleteBranchSections={obsoleteBranchSections}
        branchSelectorBranches={branchSelectorBranches}
        selectedBranchId={selectedBranchId}
        branchDiffCandidates={branchDiffCandidates}
        defaultBranchDiffRightCandidateId={defaultBranchDiffRightCandidateId}
        onBranchChange={onBranchChange}
        userId={userId}
        canManageInternalVotes={canManageInternalVotes}
        canVoteInternal={canVoteInternal}
        canVoteEvent={canVoteEvent}
        hasUserVotedOnEventCR={hasUserVotedOnEventCR}
        getEventCRSelectedChoiceIds={getEventCRSelectedChoiceIds}
        onCastEventCRVote={onCastEventCRVote}
        onOpenEventCRVoteDialog={onOpenEventCRVoteDialog}
        onCastInternalVote={onCastInternalVote}
        onFinalizeInternalVote={onFinalizeInternalVote}
      />
      <VoteCastDialog
        open={Boolean(eventVoteDialogOpen)}
        onOpenChange={setEventVoteDialogOpen}
        phase={selectedEventVotePhase}
        title={selectedEventVoteTitle}
        choices={selectedEventVoteChoices}
        requirePassword
        passwordError={passwordError}
        noVotingPasswordSettingsHref={userId ? `/user/${userId}/settings?tab=passwords` : undefined}
        isPasswordVerifying={isPasswordVerifying}
        onPasswordSubmit={onSubmitVotingPassword}
        onCastVote={onCastEventVoteFromDialog}
      />
    </>
  );
}
