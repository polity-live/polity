import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '@/features/shared/ui/ui/card';
import { Button } from '@/features/shared/ui/ui/button';
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
import { VirtualAgendaChangeRequestCardsList } from './VirtualAgendaChangeRequestCardsList';
import { MergeVariantComparisonPanel } from './MergeVariantComparisonPanel';
import { AccreditationSection } from './AccreditationSection';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { normalizeElectionMode } from '@/features/elections/logic/electionMode';
import { getOfflineTallyDialogTitle, getOfflineTallyTooltip } from '../logic/offlineTallyToolbar';
import { NamedBallotResultsDialog } from './NamedBallotResultsDialog';
import { isNamedBallot } from '@/zero/shared';
import { AmendmentBranchSelectorSection } from '@/features/amendments/ui/AmendmentBranchSelectorSection';
import { isMockCRTimelineItem } from '../logic/createMockCRTimelineItems';
import { AgendaActiveItemHeader } from './AgendaActiveItemHeader';
import { AgendaContextTabs, AgendaPageShell, AgendaVotingWorkspace } from './AgendaUiSystem';
import {
  APP_TUTORIAL_AMENDMENT_AGENDA_TITLE,
  APP_TUTORIAL_AMENDMENT_TITLE,
  APP_TUTORIAL_ELECTION_AGENDA_TITLE,
  APP_TUTORIAL_FIRST_EVENT_TITLE,
  APP_TUTORIAL_PREPARED_TEXT_CHANGES,
  getAppTutorialElectionCopy,
} from '@/features/app-tutorial/amendment-fixture';
import { APP_TUTORIAL_EXPECTED_INPUTS } from '@/features/app-tutorial/catalog';
import {
  resolveAppTutorialFixtureText,
  resolveAppTutorialFixtureValue,
} from '@/features/app-tutorial/fixture-copy';
export interface EventAgendaItemDetailViewProps {
  virtualizeChangeRequests?: boolean;
  eventId: any;
  agendaItemId: any;
  t: any;
  language?: string;
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
  cityDesigns?: any;
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
  canStartSelectedCRFinalVote?: boolean;
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
  virtualizeChangeRequests = false,
  eventId,
  agendaItemId,
  t,
  language,
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
  cityDesigns,
  amendmentDiscussions,
  crDiffMap,
  isCRVotingActive,
  crDisplayItems,
  effectiveClosingVoteItem,
  isVoteInCRList,
  selectedCRToolbarItem,
  currentCRSequenceItemId,
  nextStartableSequenceItem,
  canStartSelectedCRFinalVote = false,
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
  const isTutorialAgendaItem = Boolean(
    event?.tutorial_run_id ||
    agendaItem?.amendment?.tutorial_run_id ||
    (event?.title === APP_TUTORIAL_FIRST_EVENT_TITLE &&
      agendaItem?.amendment?.title === APP_TUTORIAL_AMENDMENT_TITLE) ||
    agendaItem?.title === APP_TUTORIAL_AMENDMENT_AGENDA_TITLE ||
    agendaItem?.title === APP_TUTORIAL_ELECTION_AGENDA_TITLE
  );
  const tutorialElectionCopy = getAppTutorialElectionCopy(language);
  const isTutorialElectionAgendaItem = Boolean(
    event?.tutorial_run_id && agendaItem?.type === 'election' && election
  );
  const displayedAgendaTitle = isTutorialElectionAgendaItem
    ? tutorialElectionCopy.agendaTitle
    : resolveAppTutorialFixtureText(agendaItem?.title, {
        tutorialRunId: event?.tutorial_run_id ?? agendaItem?.amendment?.tutorial_run_id,
        language: language === 'en' ? 'en' : 'de',
      });
  const displayedAgendaDescription = isTutorialElectionAgendaItem
    ? tutorialElectionCopy.agendaDescription
    : resolveAppTutorialFixtureText(agendaItem?.description, {
        tutorialRunId: event?.tutorial_run_id ?? agendaItem?.amendment?.tutorial_run_id,
        language: language === 'en' ? 'en' : 'de',
      });
  const displayedElection =
    election && isTutorialElectionAgendaItem
      ? {
          ...election,
          title: tutorialElectionCopy.electionTitle,
          description: tutorialElectionCopy.electionDescription,
        }
      : election;
  const useStandaloneTutorialAmendmentVote = Boolean(
    isTutorialAgendaItem && agendaItem?.amendment_id && vote
  );
  const useCRToolbar = isCRToolbarActive && !useStandaloneTutorialAmendmentVote;
  const noVotingPasswordSettingsHref = user?.id
    ? `/user/${user.id}/settings?tab=passwords`
    : undefined;
  const isDetailAgendaItemActive = detailRuntimeStatus === 'in-progress';
  const canManageCurrentVote = useCRToolbar
    ? isDetailAgendaItemActive && canManageVoteSequence
    : canManageAgenda;
  const canCompleteAgendaItem = !useCRToolbar || effectiveClosingVoteItem?.status === 'completed';
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
    !useCRToolbar && (disableVoteButton || actionBarHook.disableSecretIndicativeVoteButton);
  const disabledVoteTooltip =
    actionBarHook.secretIndicativeVoteTooltip ??
    translateText('generated.inline.0005_offline_votes_are_entered_via_tallies_0ab8a792');
  const crCardVoteDisabledTooltip = isOfflineOnlyAttendance
    ? t(
        'features.events.agenda.actions.offlineCRVoteUnavailable',
        'Im Offline-Modus können keine Online-Stimmungsabgaben abgegeben werden. Wechsle für Indication Votes in den Online- oder Hybrid-Modus.'
      )
    : undefined;
  const toolbarVoteClick = isOfflineOnlyAttendance
    ? undefined
    : useCRToolbar
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

  const persistedTutorialChangeRequests = (agendaItem.amendment?.change_requests ??
    []) as readonly {
    id: string;
    title?: string | null;
    description?: string | null;
    new_text?: string | null;
    status?: string | null;
  }[];
  const tutorialDiscussionChangeRequests = (
    Array.isArray(agendaItem.amendment?.discussions) ? agendaItem.amendment.discussions : []
  ) as readonly {
    id?: string | null;
    changeRequestEntityId?: string | null;
    title?: string | null;
    description?: string | null;
    status?: string | null;
    changeRequestStatus?: string | null;
  }[];
  const tutorialChangeRequests =
    isTutorialAgendaItem && agendaItem.amendment_id
      ? persistedTutorialChangeRequests.length > 0
        ? persistedTutorialChangeRequests
        : tutorialDiscussionChangeRequests.length > 0
          ? tutorialDiscussionChangeRequests.map((discussion, index) => ({
              id: discussion.changeRequestEntityId || discussion.id || `tutorial-cr-${index}`,
              title: discussion.title,
              description: discussion.description,
              new_text: null,
              status: discussion.changeRequestStatus || discussion.status,
            }))
          : APP_TUTORIAL_PREPARED_TEXT_CHANGES.map((changeRequest, index) => ({
              id: `tutorial-prepared-cr-${index}`,
              title: changeRequest.title,
              description: changeRequest.description,
              new_text: changeRequest.newText,
              status: 'open',
            }))
      : [];
  const tutorialRunId = event?.tutorial_run_id ?? agendaItem.amendment?.tutorial_run_id;
  const displayedTutorialChangeRequests = tutorialChangeRequests.map(changeRequest =>
    resolveAppTutorialFixtureValue(changeRequest, {
      tutorialRunId,
      language: language === 'en' ? 'en' : 'de',
    })
  );
  const hasTutorialChangeRequestReview = tutorialChangeRequests.length > 0;
  const hasChangeRequestResults = Boolean(
    agendaItem.amendment_id && (crDisplayItems.length > 0 || hasTutorialChangeRequestReview)
  );
  const hasStandaloneVoteResults = Boolean(
    vote && (!isVoteInCRList || useStandaloneTutorialAmendmentVote)
  );
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
    <AgendaItemContextCard
      className="h-full"
      presentation="embedded"
      agendaItem={{
        id: agendaItem.id,
        title: displayedAgendaTitle || '',
        description: displayedAgendaDescription ?? undefined,
        type: agendaItem.type === 'amendment' ? 'vote' : agendaItem.type || '',
        status: detailRuntimeStatus,
        duration: agendaItem.duration ?? undefined,
      }}
      amendment={
        resolveAppTutorialFixtureValue(agendaItem.amendment, {
          tutorialRunId: agendaItem.amendment?.tutorial_run_id,
          language: language === 'en' ? 'en' : 'de',
        }) ?? undefined
      }
      amendmentForwardingPreview={agendaForwardingPreview}
      amendmentPathVisualizationData={detailPathVisualizationData}
      amendmentGroupTypeById={detailGroupTypeById}
      onAmendmentGroupClick={groupId => navigate({ to: '/group/$id', params: { id: groupId } })}
      onAmendmentEventClick={targetEventId =>
        navigate({ to: '/event/$id/agenda', params: { id: targetEventId } })
      }
      election={displayedElection ?? undefined}
    />
  );

  const speakerListPanel = (
    <AgendaSpeakerListSection
      agendaItemId={agendaItem.id}
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
    <div
      data-tutorial-anchor={isTutorialAgendaItem ? 'tutorial-amendment-change-requests' : undefined}
    >
      {hasTutorialChangeRequestReview ? (
        <div className="grid gap-3">
          {displayedTutorialChangeRequests.map((changeRequest, index) => (
            <Card key={changeRequest.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {changeRequest.title || `Change Request ${index + 1}`}
                  </p>
                  <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium">
                    {changeRequest.status || 'open'}
                  </span>
                </div>
                {changeRequest.description ? (
                  <p className="text-muted-foreground text-sm">{changeRequest.description}</p>
                ) : null}
                {changeRequest.new_text ? (
                  <p className="border-border border-l-2 pl-3 text-sm">{changeRequest.new_text}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <VirtualAgendaChangeRequestCardsList
          virtualize={virtualizeChangeRequests}
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
          cityDesigns={cityDesigns}
          agendaTitle={
            resolveAppTutorialFixtureText(agendaItem.amendment?.title ?? agendaItem.title, {
              tutorialRunId: event?.tutorial_run_id ?? agendaItem?.amendment?.tutorial_run_id,
              language: language === 'en' ? 'en' : 'de',
            }) ?? null
          }
          forwardingPreview={agendaForwardingPreview}
          defaultSortMode={event?.change_request_vote_order ?? null}
          discussions={amendmentDiscussions}
          amendmentId={agendaItem.amendment_id}
          agendaItemId={agendaItemId}
          showCityDesignPreviewAccordion
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
      )}
    </div>
  ) : null;

  const electionResultsPanel = election ? (
    <div
      data-tutorial-anchor={
        isTutorialAgendaItem
          ? election.status === 'closed'
            ? 'tutorial-election-result'
            : 'tutorial-election-options'
          : undefined
      }
    >
      <AgendaElectionSection
        roleName={displayedElection?.title ?? t('features.events.agenda.role')}
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
    </div>
  ) : null;

  const voteResultsPanel =
    vote && (!isVoteInCRList || useStandaloneTutorialAmendmentVote) ? (
      <div
        data-tutorial-anchor={
          isTutorialAgendaItem && vote.status === 'closed' ? 'tutorial-amendment-result' : undefined
        }
      >
        <AgendaVoteSection
          voteId={vote.id}
          voteTitle={vote.title || displayedAgendaTitle || 'Vote'}
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
      </div>
    ) : null;
  const headerStartAt =
    agendaItem.activated_at ??
    agendaItem.start_time ??
    estimatedStartTime ??
    agendaItem.scheduled_time;
  const headerEndAt =
    agendaItem.completed_at ??
    agendaItem.end_time ??
    (headerStartAt && agendaItem.duration
      ? new Date(headerStartAt).getTime() + agendaItem.duration * 60_000
      : null);

  return (
    <AgendaPageShell>
      {/* Fixed Action Bar */}
      <AgendaActionBar
        eventId={eventId}
        currentAgendaItem={{
          id: agendaItem.id,
          type: agendaItem.type,
          status: detailRuntimeStatus,
          voting_phase: toolbarVotingPhase,
          election: election ? { id: election.id } : null,
          vote: useCRToolbar
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
        hasPreviousChangeRequest={useCRToolbar ? hasPreviousChangeRequest : undefined}
        hasNextChangeRequest={useCRToolbar ? hasNextChangeRequest : undefined}
        onPreviousChangeRequest={useCRToolbar ? handlePreviousChangeRequest : undefined}
        onNextChangeRequest={useCRToolbar ? handleNextChangeRequest : undefined}
        onJumpToNextVoteStep={
          canManageCurrentVote && useCRToolbar && nextStartableSequenceItem
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
          canManageCurrentVote && useCRToolbar
            ? toolbarVotingPhase === 'pending'
              ? handleToolbarStartVote
              : undefined
            : canManageCurrentVote && toolbarVotingPhase === 'pending'
              ? actionBarHook.handleStartVote
              : undefined
        }
        onStartFinalVote={
          canManageCurrentVote && useCRToolbar
            ? toolbarVotingPhase === 'indication' && canStartSelectedCRFinalVote
              ? handleToolbarStartFinalVote
              : undefined
            : canManageCurrentVote
              ? handleToolbarStartFinalVote
              : undefined
        }
        onCloseFinalVote={
          canManageCurrentVote && useCRToolbar
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
        data-action-scope="presentation"
        open={offlineTallyDialogOpen}
        onOpenChange={handleOfflineTallyDialogOpenChange}
        title={getOfflineTallyDialogTitle(offlineTallyPhase ?? 'indicative')}
        description={t('features.agendas.offlineTally.description', {
          item: offlineTallyEntity?.title ?? t('features.agendas.offlineTally.itemFallback'),
        })}
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
          isTutorialElectionAgendaItem && namedResultsTarget === 'election'
            ? tutorialElectionCopy.electionTitle
            : (namedResultsDialogConfig?.title ??
              translateText('features.events.agenda.namedResults.title'))
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
        phase={useCRToolbar ? selectedCRDialogPhase : actionBarHook.voteCasting.phase}
        title={useCRToolbar ? selectedCRTitle : (displayedAgendaTitle ?? undefined)}
        forwardingPreview={voteDialogForwardingPreview}
        documentPreviewContent={voteDialogDocumentPreviewContent}
        candidates={
          useCRToolbar
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
          useCRToolbar
            ? selectedCRChoices
            : vote
              ? choices.map((c: any) => ({
                  id: c.id,
                  label: c.label || translateText('features.agendas.fallbacks.choice'),
                  semanticKey: c.semantic_key ?? null,
                }))
              : undefined
        }
        tutorialAnchor={
          isTutorialAgendaItem
            ? election
              ? 'agenda-election-vote'
              : 'agenda-amendment-vote'
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
            if (isTutorialAgendaItem) {
              if (password !== APP_TUTORIAL_EXPECTED_INPUTS.votingPassword) {
                throw new Error(
                  `Invalid tutorial voting password. Use ${APP_TUTORIAL_EXPECTED_INPUTS.votingPassword}.`
                );
              }
            } else {
              await verifyVotingPassword(password);
            }
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
          useCRToolbar ? handleCastCRVoteFromDialog : actionBarHook.voteCasting.castAmendmentVote
        }
        onCastElectionVote={useCRToolbar ? undefined : actionBarHook.voteCasting.castElectionVote}
        isLoading={useCRToolbar ? false : actionBarHook.voteCasting.isLoading}
      />

      {/* Edit Election/Vote Dialog */}
      <EditElectionVoteDialog
        open={actionBarHook.editDialogOpen}
        onOpenChange={actionBarHook.setEditDialogOpen}
        agendaItemId={agendaItem.id}
        agendaItemTitle={displayedAgendaTitle ?? null}
        agendaItemDescription={displayedAgendaDescription ?? null}
        agendaItemDuration={agendaItem.duration ?? null}
        election={displayedElection ?? undefined}
        vote={vote ?? undefined}
        choices={choices.map((c: any) => ({
          id: c.id,
          label: c.label,
          order_index: c.order_index,
        }))}
      />

      <AgendaActiveItemHeader
        topLabel={toolbarAgendaItemTopNumber ? `TOP-${toolbarAgendaItemTopNumber}` : undefined}
        title={displayedAgendaTitle ?? t('features.events.agenda.details', 'Details')}
        description={displayedAgendaDescription ?? agendaItem.amendment?.reason ?? undefined}
        status={detailRuntimeStatus}
        type={agendaItem.type ?? 'discussion'}
        amendmentId={agendaItem.amendment_id ?? agendaItem.amendment?.id ?? null}
        group={agendaItem.amendment?.group ?? null}
        timing={{
          startAt: headerStartAt,
          endAt: headerEndAt,
          votingStartAt: agendaItem.activated_at ?? agendaItem.start_time,
          votingEndAt: election?.closing_end_time ?? vote?.closing_end_time,
          durationMinutes: agendaItem.duration ?? null,
          startIsEstimated: !agendaItem.activated_at && !agendaItem.start_time,
          endIsEstimated: !agendaItem.completed_at && !agendaItem.end_time,
        }}
      />

      <section
        data-testid="agenda-detail-context-switcher"
        aria-label={t('features.events.agenda.details')}
      >
        <AgendaContextTabs
          value={activeContextPane}
          onValueChange={setActiveContextPane}
          detailsLabel={t('features.events.agenda.details', 'Details')}
          speakersLabel={t('features.events.agenda.speakerList', 'Speaker list')}
          details={<div data-testid="agenda-detail-context-details">{agendaDetailsPanel}</div>}
          speakers={<div data-testid="agenda-detail-context-speakers">{speakerListPanel}</div>}
        />
      </section>

      {hasResultsPanel ? (
        <AgendaVotingWorkspace
          data-testid="agenda-detail-results"
          className="scroll-mt-20"
          mode="detail"
          title={t('features.events.agenda.voteResults', 'Results')}
          description={t(
            'features.events.agenda.votingWorkspaceDescription',
            'Voting progress, decisions, and results for this agenda item.'
          )}
          changeRequests={changeRequestResultsPanel}
          election={electionResultsPanel}
          vote={voteResultsPanel}
        />
      ) : null}

      {delegateTargetEvent ? <EventSearchCard event={delegateTargetEvent} /> : null}

      <MergeVariantComparisonPanel candidates={mergeVariantCandidates} />

      {/* Accreditation Section */}
      {agendaItem.type === 'accreditation' && (
        <AccreditationSection eventId={eventId} agendaItemId={agendaItemId} />
      )}
    </AgendaPageShell>
  );
}
