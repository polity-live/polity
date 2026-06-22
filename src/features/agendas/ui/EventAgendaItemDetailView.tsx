import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/features/shared/ui/ui/accordion';
import { cn } from '@/features/shared/utils/utils';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { CandidatesByElectionRow } from '@/zero/elections/queries';
import type { ChoicesByVoteRow } from '@/zero/votes/queries';
import { AgendaItemContextCard } from './AgendaItemContextCard';
import { EventSearchCard } from '@/features/search/ui/EventSearchCard';
import { AgendaSpeakerListSection } from './AgendaSpeakerListSection';
import { AgendaVoteSection } from './AgendaVoteSection';
import { AgendaElectionSection, isAutoAssignedRoleElection } from './AgendaElectionSection';
import { OfflineTallyDialog } from './OfflineTallyDialog';
import { AgendaActionBar } from './AgendaActionBar';
import { EditElectionVoteDialog } from './EditElectionVoteDialog';
import { VoteCastDialog } from '@/features/vote-cast/ui/VoteCastDialog';
import { CandidacyPasswordDialog } from '@/features/elections/ui/CandidacyPasswordDialog';
import { ChangeRequestCardsList } from './ChangeRequestCardsList';
import { MergeVariantComparisonPanel } from './MergeVariantComparisonPanel';
import { AccreditationSection } from './AccreditationSection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { getOfflineTallyDialogTitle, getOfflineTallyTooltip } from '../logic/offlineTallyToolbar';
import { NamedBallotResultsDialog } from './NamedBallotResultsDialog';
import { isNamedBallot } from '@/zero/shared';
import { AmendmentBranchSelectorSection } from '@/features/amendments/ui/AmendmentBranchSelectorSection';
import { isMockCRTimelineItem } from '../logic/createMockCRTimelineItems';
export interface EventAgendaItemDetailViewProps {
  eventId: any;
  agendaItemId: any;
  t: any;
  navigate: any;
  updateSpeaker: any;
  agendaItem: any;
  agendaBranchEditingMode?: any;
  branchSelectorBranches?: any;
  selectedBranchId?: any;
  branchDiffCandidates?: any;
  defaultBranchDiffRightCandidateId?: any;
  onBranchChange?: any;
  event: any;
  user: any;
  userRecord?: any;
  isLoading: any;
  votingLoading: any;
  addingSpeaker: any;
  election: any;
  candidates: any;
  vote: any;
  choices: any;
  userElector: any;
  userVoter: any;
  estimatedStartTime: any;
  forwardingContext: any;
  handleDelete: any;
  handleAddToSpeakerList: any;
  delegateAssignmentMeta: any;
  delegateTargetEvent: any;
  can: any;
  canVote: any;
  canBeCandidate: any;
  canManageAgenda: any;
  canManageVotes: any;
  canManageVoteSequence?: any;
  canJoinSpeakerList: any;
  canManageOfflineTallies: any;
  hasVotingRight: any;
  hasCandidateRight: any;
  rosterEvent: any;
  attendanceMode: any;
  disableVoteButton: any;
  allowsOfflineTallies: any;
  confirmedOfflineParticipantCount: any;
  eligibleFinalVoterCount?: number;
  agendaNav: any;
  verifyVotingPassword: any;
  upsertElectionOfflineTally: any;
  upsertVoteOfflineTally: any;
  passwordError: any;
  setPasswordError: any;
  isPasswordVerifying: any;
  setIsPasswordVerifying: any;
  offlineTallyDialogOpen: any;
  setOfflineTallyDialogOpen: any;
  offlineTallyPasswordError: any;
  setOfflineTallyPasswordError: any;
  offlineTallySubmitError: any;
  setOfflineTallySubmitError: any;
  isOfflineTallySubmitting: any;
  setIsOfflineTallySubmitting: any;
  namedResultsTarget: any;
  setNamedResultsTarget: any;
  effectiveVotingPhase: any;
  crTimeline: any;
  currentCRItem: any;
  completedItems: any;
  progress: any;
  isTimelineComplete: any;
  allCRsProcessed: any;
  hasUserVotedOnCR: any;
  getUserSelectedChoiceIds: any;
  startIndicativePhase: any;
  startFinalPhase: any;
  closeVoting: any;
  castCRVote: any;
  actionBarHook: any;
  setMarkingSpeakerComplete: any;
  selectedCRToolbarItemId: any;
  setSelectedCRToolbarItemId: any;
  mockCRItems: any;
  documentContent: any;
  amendmentDiscussions: any;
  crDiffMap: any;
  hasAmendmentCRs: any;
  crDisplayItemsBase: any;
  isCRVotingActive: any;
  timelineHasClosingVote: any;
  synthesizedClosingVoteItem: any;
  crDisplayItems: any;
  effectiveClosingVoteItem: any;
  isVoteInCRList: any;
  nonFinalCRItems: any;
  fallbackSelectedCRItemId: any;
  selectedCRToolbarItem: any;
  currentCRSequenceItemId?: any;
  nextStartableSequenceItem?: any;
  isCRToolbarActive: any;
  selectedCRPhase: any;
  isSelectedClosingVote: any;
  hasUserVotedOnSelectedCR: any;
  selectedCRToolbarIndex: any;
  hasPreviousChangeRequest: any;
  hasNextChangeRequest: any;
  handlePreviousChangeRequest: any;
  handleNextChangeRequest: any;
  handleJumpToNextStartableSequenceItem?: any;
  handleStartSequenceFinalVote: any;
  handleToolbarStartVote: any;
  handleToolbarStartFinalVote: any;
  handleToolbarCloseVote: any;
  handleCastCRVoteFromDialog: any;
  selectedCRTitle: any;
  selectedCRChoices: any;
  selectedCRDialogPhase: any;
  voteDialogDocumentPreviewContent?: any;
  agendaForwardingPreview: any;
  voteDialogForwardingPreview: any;
  mergeVariantCandidates: any;
  detailGroupTypeById: any;
  detailDerivedActiveStepRun: any;
  detailResolvedActiveBranchId: any;
  detailFirstUnresolvedStepId: any;
  detailPathVisualizationData: any;
  toolbarVotingPhase: any;
  toolbarAgendaItem: any;
  toolbarAgendaItemIndex: any;
  toolbarAgendaItemTopNumber: any;
  detailRuntimeStatus: any;
  handleToolbarStartItem: any;
  startVoteTooltip: any;
  startFinalVoteTooltip: any;
  closeVoteTooltip: any;
  castIndicativeVoteTooltip: any;
  castFinalVoteTooltip: any;
  handleMarkSpeakerCompleted: any;
  speakerListData: any;
  showSpeakerGender?: any;
  isUserInSpeakerList: any;
  activeRosterParticipants: any;
  isDelegateAssembly: any;
  participantsWithProvenance: any;
  eligibleParticipantsForNamedResults: any;
  confirmedOfflineParticipants: any;
  indicativeSelections: any;
  finalSelections: any;
  userHasElectionVoted: any;
  userSelectedCandidateIds: any;
  offlineTallyPhaseSource: any;
  offlineTallyPhase: any;
  indicativeDecisions: any;
  finalDecisions: any;
  userHasVoteVoted: any;
  userSelectedChoiceIds: any;
  namedElectionResults: any;
  namedVoteResults: any;
  namedResultsDialogConfig: any;
  offlineTallyEntity: any;
  offlineTallyActionMode: any;
  showOfflineTallyButton: any;
  handleOfflineTallyDialogOpenChange: any;
  handleOpenOfflineTallyDialog: any;
  handleSubmitOfflineTally: any;
}

export function EventAgendaItemDetailView({
  eventId,
  agendaItemId,
  t,
  navigate,
  agendaItem,
  agendaBranchEditingMode,
  branchSelectorBranches,
  selectedBranchId,
  branchDiffCandidates,
  defaultBranchDiffRightCandidateId,
  onBranchChange,
  event,
  user,
  userRecord,
  isLoading,
  votingLoading,
  addingSpeaker,
  election,
  candidates,
  vote,
  choices,
  estimatedStartTime,
  handleDelete,
  handleAddToSpeakerList,
  delegateAssignmentMeta,
  delegateTargetEvent,
  canManageAgenda,
  canManageVoteSequence = canManageAgenda,
  canJoinSpeakerList,
  hasVotingRight,
  hasCandidateRight,
  attendanceMode,
  disableVoteButton,
  confirmedOfflineParticipantCount,
  eligibleFinalVoterCount,
  agendaNav,
  verifyVotingPassword,
  passwordError,
  setPasswordError,
  isPasswordVerifying,
  setIsPasswordVerifying,
  offlineTallyDialogOpen,
  offlineTallyPasswordError,
  offlineTallySubmitError,
  isOfflineTallySubmitting,
  namedResultsTarget,
  setNamedResultsTarget,
  completedItems,
  progress,
  isTimelineComplete,
  allCRsProcessed,
  hasUserVotedOnCR,
  getUserSelectedChoiceIds,
  startIndicativePhase,
  closeVoting,
  castCRVote,
  actionBarHook,
  documentContent,
  amendmentDiscussions,
  crDiffMap,
  isCRVotingActive,
  crDisplayItems,
  effectiveClosingVoteItem,
  isVoteInCRList,
  selectedCRToolbarItem,
  currentCRSequenceItemId,
  nextStartableSequenceItem,
  setSelectedCRToolbarItemId,
  isCRToolbarActive,
  hasUserVotedOnSelectedCR,
  hasPreviousChangeRequest,
  hasNextChangeRequest,
  handlePreviousChangeRequest,
  handleNextChangeRequest,
  handleJumpToNextStartableSequenceItem,
  handleStartSequenceFinalVote,
  handleToolbarStartVote,
  handleToolbarStartFinalVote,
  handleToolbarCloseVote,
  handleCastCRVoteFromDialog,
  selectedCRTitle,
  selectedCRChoices,
  selectedCRDialogPhase,
  voteDialogDocumentPreviewContent,
  agendaForwardingPreview,
  voteDialogForwardingPreview,
  mergeVariantCandidates,
  detailGroupTypeById,
  detailPathVisualizationData,
  toolbarVotingPhase,
  toolbarAgendaItem,
  toolbarAgendaItemTopNumber,
  detailRuntimeStatus,
  handleToolbarStartItem,
  startVoteTooltip,
  startFinalVoteTooltip,
  closeVoteTooltip,
  castIndicativeVoteTooltip,
  castFinalVoteTooltip,
  handleMarkSpeakerCompleted,
  speakerListData,
  showSpeakerGender,
  isUserInSpeakerList,
  indicativeSelections,
  finalSelections,
  userHasElectionVoted,
  userSelectedCandidateIds,
  offlineTallyPhase,
  indicativeDecisions,
  finalDecisions,
  userHasVoteVoted,
  userSelectedChoiceIds,
  namedResultsDialogConfig,
  offlineTallyEntity,
  offlineTallyActionMode,
  showOfflineTallyButton,
  handleOfflineTallyDialogOpenChange,
  handleOpenOfflineTallyDialog,
  handleSubmitOfflineTally,
}: EventAgendaItemDetailViewProps) {
  const [activeContextPane, setActiveContextPane] = useState<'details' | 'speakers'>('details');
  const noVotingPasswordSettingsHref = user?.id
    ? `/user/${user.id}/settings?tab=passwords`
    : undefined;
  const isDetailAgendaItemActive = detailRuntimeStatus === 'in-progress';
  const canManageCurrentVote = isCRToolbarActive
    ? isDetailAgendaItemActive && canManageVoteSequence
    : canManageAgenda;
  const canCompleteAgendaItem =
    !isCRToolbarActive || effectiveClosingVoteItem?.status === 'completed';
  const isOfflineOnlyAttendance = attendanceMode === 'offline';
  const selectedCRIsPlaceholder = Boolean(
    (selectedCRToolbarItem as { _votePlaceholder?: boolean } | null)?._votePlaceholder
  );
  const selectedCRIsMockTimelineItem =
    selectedCRToolbarItem !== null && isMockCRTimelineItem(selectedCRToolbarItem);
  const selectedCRHasVoteChoices = selectedCRChoices.length > 0;
  const canCastSelectedCRVote =
    !selectedCRIsPlaceholder && !selectedCRIsMockTimelineItem && selectedCRHasVoteChoices;
  const voteButtonDisabled =
    !isCRToolbarActive && (disableVoteButton || actionBarHook.disableSecretIndicativeVoteButton);
  const disabledVoteTooltip =
    actionBarHook.secretIndicativeVoteTooltip ??
    translateText('generated.inline.0005_offline_votes_are_entered_via_tallies_0ab8a792');
  const crCardVoteDisabledTooltip = isOfflineOnlyAttendance
    ? t(
        'features.events.agenda.actions.offlineCRVoteUnavailable',
        'Im Offline-Modus koennen keine Online-Stimmungsabgaben abgegeben werden. Wechsle fuer Indication Votes in den Online- oder Hybrid-Modus.'
      )
    : undefined;
  const toolbarVoteClick = isOfflineOnlyAttendance
    ? undefined
    : isCRToolbarActive
      ? toolbarVotingPhase !== 'closed' && !hasUserVotedOnSelectedCR && canCastSelectedCRVote
        ? actionBarHook.handleVoteClick
        : undefined
      : actionBarHook.handleVoteClick;
  const handleOpenCRVoteDialog = (itemId: string) => {
    setSelectedCRToolbarItemId(itemId);
    actionBarHook.handleVoteClick();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-muted h-8 animate-pulse rounded"></div>
        <div className="bg-muted h-64 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!agendaItem || !event) {
    return (
      <Card>
        <CardContent align="center" className="p-6">
          <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-2xl font-bold">
            {translateText('generated.inline.0051_tagesordnungspunkt_nicht_gefunden_6faf6631')}
          </h2>
          <p className="text-muted-foreground mb-4">
            {translateText(
              'generated.inline.0052_der_gesuchte_tagesordnungspunkt_existiert_nic_234c07d7'
            )}
          </p>
          <Button asChild>
            <Link to="/event/$id/agenda" params={{ id: eventId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {translateText('generated.inline.0053_zur_ck_zur_tagesordnung_c45114ea')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isSpeakersPaneActive = activeContextPane === 'speakers';
  const contextToggleLabel = isSpeakersPaneActive ? 'Details' : 'Redeliste';
  const renderContextToggleButton = () => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid="agenda-detail-context-toggle"
      aria-label={contextToggleLabel}
      onClick={() =>
        setActiveContextPane(current => (current === 'details' ? 'speakers' : 'details'))
      }
    >
      {contextToggleLabel}
    </Button>
  );
  const hasChangeRequestResults = Boolean(agendaItem.amendment_id && crDisplayItems.length > 0);
  const hasStandaloneVoteResults = Boolean(vote && !isVoteInCRList);
  const hasResultsPanel = Boolean(election || hasStandaloneVoteResults || hasChangeRequestResults);
  const branchSwitcher =
    branchSelectorBranches?.length > 1 && onBranchChange ? (
      <AmendmentBranchSelectorSection
        variant="inline"
        branches={branchSelectorBranches}
        selectedBranchId={selectedBranchId ?? null}
        branchDiffCandidates={branchDiffCandidates ?? []}
        defaultDiffRightCandidateId={defaultBranchDiffRightCandidateId ?? null}
        onBranchChange={onBranchChange}
      />
    ) : null;

  const agendaDetailsPanel = (
    <Accordion type="single" collapsible defaultValue="agenda-details">
      <AccordionItem value="agenda-details" className="border-b-0">
        <AccordionTrigger
          className="bg-card hover:bg-muted/50 rounded-lg border px-4 py-3 text-sm font-semibold hover:no-underline"
          data-testid="agenda-detail-details-accordion-trigger"
        >
          {t('features.events.agenda.details', 'Details')}
        </AccordionTrigger>
        <AccordionContent className="pt-3 pb-0">
          <AgendaItemContextCard
            className="h-full"
            agendaItem={{
              id: agendaItem.id,
              title: agendaItem.title || '',
              description: agendaItem.description ?? undefined,
              type: agendaItem.type === 'amendment' ? 'vote' : agendaItem.type || '',
              status: detailRuntimeStatus,
              duration: agendaItem.duration ?? undefined,
              scheduledTime:
                estimatedStartTime?.toISOString() ?? agendaItem.scheduled_time ?? undefined,
              startTime: agendaItem.start_time ? new Date(agendaItem.start_time) : undefined,
              endTime: agendaItem.end_time ? new Date(agendaItem.end_time) : undefined,
              activatedAt: agendaItem.activated_at ? new Date(agendaItem.activated_at) : undefined,
              completedAt: agendaItem.completed_at ? new Date(agendaItem.completed_at) : undefined,
            }}
            amendment={agendaItem.amendment ?? undefined}
            amendmentForwardingPreview={agendaForwardingPreview}
            amendmentPathVisualizationData={detailPathVisualizationData}
            amendmentGroupTypeById={detailGroupTypeById}
            onAmendmentGroupClick={groupId =>
              navigate({ to: '/group/$id', params: { id: groupId } })
            }
            onAmendmentEventClick={targetEventId =>
              navigate({ to: '/event/$id/agenda', params: { id: targetEventId } })
            }
            election={election ?? undefined}
            votingStartTime={
              (agendaItem.activated_at ?? agendaItem.start_time)
                ? new Date(agendaItem.activated_at ?? agendaItem.start_time)
                : undefined
            }
            votingEndTime={
              (election?.closing_end_time ?? vote?.closing_end_time)
                ? new Date(election?.closing_end_time ?? vote?.closing_end_time ?? 0)
                : undefined
            }
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  const speakerListPanel = (
    <AgendaSpeakerListSection
      className="h-full"
      speakers={speakerListData}
      isUserInSpeakerList={isUserInSpeakerList}
      canManageSpeakers={canManageAgenda}
      isAddingSpeaker={addingSpeaker}
      isRemovingSpeaker={actionBarHook.speakerLoading}
      userId={user?.id}
      agendaStartTime={agendaItem.activated_at ?? agendaItem.start_time ?? undefined}
      showGender={Boolean(showSpeakerGender)}
      onAddToSpeakerList={canJoinSpeakerList ? handleAddToSpeakerList : undefined}
      onRemoveFromSpeakerList={actionBarHook.handleLeaveSpeakerList}
      onMarkCompleted={handleMarkSpeakerCompleted}
    />
  );

  const changeRequestResultsPanel = hasChangeRequestResults ? (
    <ChangeRequestCardsList
      items={crDisplayItems}
      editingMode={agendaBranchEditingMode}
      isVotingActive={isCRVotingActive}
      userId={user?.id}
      canManage={isDetailAgendaItemActive && canManageVoteSequence}
      canVote={hasVotingRight && !isOfflineOnlyAttendance}
      voteDisabledTooltip={crCardVoteDisabledTooltip}
      hideInlineVotingControls
      showAgendaDetailsVoteActions
      currentItemId={
        isCRVotingActive ? (currentCRSequenceItemId ?? selectedCRToolbarItem?.id) : null
      }
      progress={isCRVotingActive ? progress : undefined}
      eligibleFinalVoterCount={eligibleFinalVoterCount}
      completedCount={isCRVotingActive ? completedItems.length : undefined}
      allCRsProcessed={isCRVotingActive ? allCRsProcessed : undefined}
      isTimelineComplete={isCRVotingActive ? isTimelineComplete : undefined}
      diffMap={crDiffMap}
      documentContent={documentContent}
      agendaTitle={agendaItem.amendment?.title ?? agendaItem.title ?? null}
      defaultSortMode={event?.change_request_vote_order ?? null}
      discussions={amendmentDiscussions}
      amendmentId={agendaItem.amendment_id ?? undefined}
      agendaItemId={agendaItemId}
      userRecord={userRecord}
      hasUserVoted={isCRVotingActive ? hasUserVotedOnCR : undefined}
      getUserSelectedChoiceIds={isCRVotingActive ? getUserSelectedChoiceIds : undefined}
      onCastVote={isCRVotingActive && isDetailAgendaItemActive ? castCRVote : undefined}
      onOpenVoteDialog={isCRVotingActive ? handleOpenCRVoteDialog : undefined}
      onStartIndicative={
        isCRVotingActive && isDetailAgendaItemActive ? startIndicativePhase : undefined
      }
      onStartFinal={
        isCRVotingActive && isDetailAgendaItemActive ? handleStartSequenceFinalVote : undefined
      }
      onCloseVoting={isCRVotingActive && isDetailAgendaItemActive ? closeVoting : undefined}
      sequenceInterstitial={branchSwitcher}
    />
  ) : null;

  const electionResultsPanel = election ? (
    <AgendaElectionSection
      roleName={election.title ?? t('features.events.agenda.role')}
      electionMode={election.election_mode ? normalizeElectionMode(election.election_mode) : null}
      seatCount={election.seat_count}
      candidates={[...candidates] as CandidatesByElectionRow[]}
      indicativeSelections={indicativeSelections}
      finalSelections={finalSelections}
      offlineTallies={election.offline_tallies ?? []}
      attendanceMode={attendanceMode}
      delegateTargetEventId={delegateTargetEvent?.id ?? delegateAssignmentMeta?.targetEventId}
      delegateTargetEventTitle={delegateTargetEvent?.title ?? null}
      showRoleAssignedMessage={isAutoAssignedRoleElection(election)}
      userHasVoted={userHasElectionVoted}
      userSelectedCandidateIds={userSelectedCandidateIds}
      electionStatus={election.status}
      canVote={hasVotingRight}
      canBeCandidate={hasCandidateRight}
      isUserCandidate={actionBarHook.isUserCandidate}
      isVotingLoading={votingLoading === election.id}
      isCandidateLoading={actionBarHook.candidateLoading}
      onBecomeCandidate={actionBarHook.handleBecomeCandidate}
      onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
      onOpenNamedResults={
        isNamedBallot(election.ballot_visibility)
          ? () => setNamedResultsTarget('election')
          : undefined
      }
    />
  ) : null;

  const voteResultsPanel =
    vote && !isVoteInCRList ? (
      <AgendaVoteSection
        voteId={vote.id}
        voteTitle={vote.title || agendaItem.title || 'Vote'}
        choices={[...choices] as ChoicesByVoteRow[]}
        indicativeDecisions={indicativeDecisions}
        finalDecisions={finalDecisions}
        offlineTallies={vote.offline_tallies ?? []}
        attendanceMode={attendanceMode}
        userHasVoted={userHasVoteVoted}
        userSelectedChoiceIds={userSelectedChoiceIds}
        voteStatus={vote.status}
        majorityType={vote.majority_type}
        totalEligibleVoters={eligibleFinalVoterCount}
        canManageOfflineResults={canManageAgenda}
        offlineEligibleCount={confirmedOfflineParticipantCount}
        forwardingPreview={agendaForwardingPreview}
        onOpenNamedResults={
          isNamedBallot(vote.ballot_visibility) ? () => setNamedResultsTarget('vote') : undefined
        }
      />
    ) : null;

  return (
    <div className="space-y-6">
      {/* Fixed Action Bar */}
      <AgendaActionBar
        eventId={eventId}
        currentAgendaItem={{
          id: agendaItem.id,
          type: agendaItem.type,
          status: detailRuntimeStatus,
          voting_phase: toolbarVotingPhase,
          election: election ? { id: election.id } : null,
          vote: isCRToolbarActive
            ? selectedCRToolbarItem?.vote
              ? { id: selectedCRToolbarItem.vote.id }
              : null
            : vote
              ? { id: vote.id }
              : null,
        }}
        canManageAgenda={actionBarHook.canManageAgenda}
        canVote={actionBarHook.hasVotingRight}
        canBeCandidate={actionBarHook.hasCandidateRight}
        isEventStarted={event?.status === 'active' || event?.status === 'in-progress'}
        isUserInSpeakerList={actionBarHook.isUserInSpeakerList}
        isUserCandidate={actionBarHook.isUserCandidate}
        currentItemLabel={
          toolbarAgendaItemTopNumber ? `TOP-${toolbarAgendaItemTopNumber}` : undefined
        }
        currentItemTitle={toolbarAgendaItem?.title ?? undefined}
        onOpenCurrentItem={
          toolbarAgendaItem
            ? () =>
                navigate({
                  to: '/event/$id/agenda/$agendaItemId',
                  params: { id: eventId, agendaItemId: toolbarAgendaItem.id },
                })
            : undefined
        }
        hasPreviousItem={agendaNav.hasPreviousItem}
        hasNextItem={agendaNav.hasNextItem}
        hasStartableItem={agendaNav.hasStartableItem}
        canMoveToNextItem={agendaNav.canMoveToNextItem}
        isCurrentItemCompleted={agendaNav.isCurrentItemCompleted}
        onStartItem={handleToolbarStartItem}
        onPreviousItem={agendaNav.moveToPreviousItem}
        onNextItem={agendaNav.moveToNextItem}
        onCompleteItem={canCompleteAgendaItem ? agendaNav.completeCurrentItem : undefined}
        hasPreviousChangeRequest={isCRToolbarActive ? hasPreviousChangeRequest : undefined}
        hasNextChangeRequest={isCRToolbarActive ? hasNextChangeRequest : undefined}
        onPreviousChangeRequest={isCRToolbarActive ? handlePreviousChangeRequest : undefined}
        onNextChangeRequest={isCRToolbarActive ? handleNextChangeRequest : undefined}
        onJumpToNextVoteStep={
          canManageCurrentVote && isCRToolbarActive && nextStartableSequenceItem
            ? handleJumpToNextStartableSequenceItem
            : undefined
        }
        navigationLoading={agendaNav.isLoading}
        speakerLoading={actionBarHook.speakerLoading}
        candidateLoading={actionBarHook.candidateLoading}
        voteLoading={actionBarHook.voteCasting.isLoading || Boolean(votingLoading)}
        onBackToAgenda={() => navigate({ to: '/event/$id/agenda', params: { id: eventId } })}
        onEditItem={actionBarHook.handleEditClick}
        onDeleteItem={handleDelete}
        onJoinSpeakerList={
          actionBarHook.canJoinSpeakerList ? actionBarHook.handleJoinSpeakerList : undefined
        }
        onLeaveSpeakerList={actionBarHook.handleLeaveSpeakerList}
        onBecomeCandidate={actionBarHook.handleBecomeCandidate}
        onWithdrawCandidacy={actionBarHook.handleWithdrawCandidacy}
        onStartVote={
          canManageCurrentVote && isCRToolbarActive
            ? toolbarVotingPhase === 'pending'
              ? handleToolbarStartVote
              : undefined
            : canManageCurrentVote && toolbarVotingPhase === 'pending'
              ? actionBarHook.handleStartVote
              : undefined
        }
        onStartFinalVote={
          canManageCurrentVote && isCRToolbarActive
            ? toolbarVotingPhase === 'indication'
              ? handleToolbarStartFinalVote
              : undefined
            : canManageCurrentVote
              ? handleToolbarStartFinalVote
              : undefined
        }
        onCloseFinalVote={
          canManageCurrentVote && isCRToolbarActive
            ? toolbarVotingPhase === 'final'
              ? handleToolbarCloseVote
              : undefined
            : canManageCurrentVote
              ? handleToolbarCloseVote
              : undefined
        }
        onVoteClick={toolbarVoteClick}
        disableVoteButton={voteButtonDisabled}
        disabledVoteTooltip={disabledVoteTooltip}
        showOfflineTallyButton={showOfflineTallyButton}
        onOfflineTallyClick={showOfflineTallyButton ? handleOpenOfflineTallyDialog : undefined}
        offlineTallyMode={offlineTallyActionMode}
        offlineTallyTooltip={getOfflineTallyTooltip({
          phase: offlineTallyPhase,
          mode: offlineTallyActionMode,
        })}
        startVoteTooltip={startVoteTooltip}
        startFinalVoteTooltip={startFinalVoteTooltip}
        closeVoteTooltip={closeVoteTooltip}
        jumpToNextVoteStepTooltip={t(
          'features.agendas.crTimeline.nextVotingStep',
          'Next voting step'
        )}
        castIndicativeVoteTooltip={castIndicativeVoteTooltip}
        castFinalVoteTooltip={castFinalVoteTooltip}
      />
      {/* Spacer for fixed toolbar */}
      <div className="h-10" />

      <OfflineTallyDialog
        open={offlineTallyDialogOpen}
        onOpenChange={handleOfflineTallyDialogOpenChange}
        title={getOfflineTallyDialogTitle(offlineTallyPhase ?? 'indicative')}
        description={`Enter aggregated offline or hybrid selections for ${offlineTallyEntity?.title ?? 'this item'} and confirm with your voting PIN.`}
        phase={offlineTallyPhase ?? 'indicative'}
        choices={offlineTallyEntity?.choices ?? []}
        tallies={offlineTallyEntity?.tallies ?? []}
        maxTotalVotes={offlineTallyEntity?.maxTotalVotes ?? null}
        maxPerEntryVotes={offlineTallyEntity?.maxPerEntryVotes ?? null}
        maxPerEntryLimitLabel={
          offlineTallyEntity?.kind === 'election'
            ? translateText('features.events.agenda.candidate')
            : undefined
        }
        participantCount={offlineTallyEntity?.participantCount ?? null}
        votesPerParticipant={offlineTallyEntity?.votesPerParticipant ?? null}
        isSubmitting={isOfflineTallySubmitting}
        passwordError={offlineTallyPasswordError}
        noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
        submitError={offlineTallySubmitError}
        onSubmit={handleSubmitOfflineTally}
      />

      <NamedBallotResultsDialog
        open={namedResultsTarget !== null}
        onOpenChange={open => {
          if (!open) {
            setNamedResultsTarget(null);
          }
        }}
        title={
          namedResultsDialogConfig?.title ??
          translateText('features.events.agenda.namedResults.title')
        }
        description={namedResultsDialogConfig?.description ?? ''}
        model={namedResultsDialogConfig?.model ?? null}
      />

      <CandidacyPasswordDialog
        {...actionBarHook.candidacyDialogProps}
        noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
      />

      {/* Vote Cast Dialog (with password support) */}
      <VoteCastDialog
        open={actionBarHook.voteDialogOpen}
        onOpenChange={actionBarHook.setVoteDialogOpen}
        phase={isCRToolbarActive ? selectedCRDialogPhase : actionBarHook.voteCasting.phase}
        title={isCRToolbarActive ? selectedCRTitle : (agendaItem.title ?? undefined)}
        forwardingPreview={voteDialogForwardingPreview}
        documentPreviewContent={voteDialogDocumentPreviewContent}
        candidates={
          isCRToolbarActive
            ? undefined
            : election
              ? candidates.map((c: any) => ({
                  id: c.id,
                  name: c.user
                    ? `${c.user.first_name ?? ''} ${c.user.last_name ?? ''}`.trim() ||
                      c.user.email ||
                      translateText('features.events.agenda.candidate')
                    : c.name || translateText('features.events.agenda.candidate'),
                  avatar: c.user?.avatar ?? undefined,
                }))
              : undefined
        }
        maxVotes={election?.max_votes ?? 1}
        electionMode={
          election?.election_mode ? normalizeElectionMode(election.election_mode) : null
        }
        seatCount={election?.seat_count ?? null}
        choices={
          isCRToolbarActive
            ? selectedCRChoices
            : vote
              ? choices.map((c: any) => ({
                  id: c.id,
                  label: c.label || 'Choice',
                }))
              : undefined
        }
        requirePassword
        passwordError={passwordError}
        noVotingPasswordSettingsHref={noVotingPasswordSettingsHref}
        isPasswordVerifying={isPasswordVerifying}
        onPasswordSubmit={async (password: string) => {
          setPasswordError(null);
          setIsPasswordVerifying(true);
          try {
            await verifyVotingPassword(password);
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : translateText('generated.inline.0010_verification_failed_e10d7e51');
            setPasswordError(message);
            throw err;
          } finally {
            setIsPasswordVerifying(false);
          }
        }}
        onCastVote={
          isCRToolbarActive
            ? handleCastCRVoteFromDialog
            : actionBarHook.voteCasting.castAmendmentVote
        }
        onCastElectionVote={
          isCRToolbarActive ? undefined : actionBarHook.voteCasting.castElectionVote
        }
        isLoading={isCRToolbarActive ? false : actionBarHook.voteCasting.isLoading}
      />

      {/* Edit Election/Vote Dialog */}
      <EditElectionVoteDialog
        open={actionBarHook.editDialogOpen}
        onOpenChange={actionBarHook.setEditDialogOpen}
        agendaItemId={agendaItem.id}
        agendaItemTitle={agendaItem.title ?? null}
        agendaItemDescription={agendaItem.description ?? null}
        agendaItemDuration={agendaItem.duration ?? null}
        election={election ?? undefined}
        vote={vote ?? undefined}
        choices={choices.map((c: any) => ({
          id: c.id,
          label: c.label,
          order_index: c.order_index,
        }))}
      />

      <section
        data-testid="agenda-detail-context-switcher"
        className="relative overflow-hidden"
        aria-label={t('features.events.agenda.details')}
      >
        <div
          data-testid="agenda-detail-context-details"
          aria-hidden={isSpeakersPaneActive}
          inert={isSpeakersPaneActive ? true : undefined}
          className={cn(
            'transition-[opacity,transform] duration-300 ease-out',
            isSpeakersPaneActive
              ? 'pointer-events-none absolute inset-x-0 top-0 -translate-x-full opacity-0'
              : 'relative translate-x-0 opacity-100'
          )}
        >
          {!isSpeakersPaneActive ? (
            <div className="mb-2 flex justify-end">{renderContextToggleButton()}</div>
          ) : null}
          {agendaDetailsPanel}
        </div>

        <div
          data-testid="agenda-detail-context-speakers"
          aria-hidden={!isSpeakersPaneActive}
          inert={!isSpeakersPaneActive ? true : undefined}
          className={cn(
            'transition-[opacity,transform] duration-300 ease-out',
            isSpeakersPaneActive
              ? 'relative translate-x-0 opacity-100'
              : 'pointer-events-none absolute inset-x-0 top-0 translate-x-full opacity-0'
          )}
        >
          {isSpeakersPaneActive ? (
            <div className="mb-2 flex justify-end">{renderContextToggleButton()}</div>
          ) : null}
          {speakerListPanel}
        </div>
      </section>

      {hasResultsPanel ? (
        <section data-testid="agenda-detail-results" className="scroll-mt-20">
          <div className="space-y-4">
            {changeRequestResultsPanel}
            {electionResultsPanel}
            {voteResultsPanel}
          </div>
        </section>
      ) : null}

      {delegateTargetEvent ? <EventSearchCard event={delegateTargetEvent} /> : null}

      <MergeVariantComparisonPanel candidates={mergeVariantCandidates} />

      {/* Accreditation Section */}
      {agendaItem.type === 'accreditation' && (
        <AccreditationSection eventId={eventId} agendaItemId={agendaItemId} />
      )}
    </div>
  );
}
