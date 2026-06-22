'use client';

import { useTranslation } from '@/features/shared/hooks/use-translation';

interface CurrentAgendaItem {
  id: string;
  type: string | null;
  status: string | null;
  voting_phase?: string | null;
  election?: { id: string } | null;
  vote?: { id: string } | null;
}

interface AgendaActionBarProps {
  eventId: string;
  currentAgendaItem?: CurrentAgendaItem | null;
  currentItemLabel?: string | null;
  currentItemTitle?: string | null;
  onOpenCurrentItem?: () => void;

  canManageAgenda: boolean;
  canVote: boolean;
  canBeCandidate: boolean;

  isEventStarted: boolean;

  isUserInSpeakerList: boolean;
  isUserCandidate: boolean;

  hasPreviousItem?: boolean;
  hasNextItem?: boolean;
  hasStartableItem?: boolean;
  canMoveToNextItem?: boolean;
  isCurrentItemCompleted?: boolean;
  onStartItem?: () => void;
  onPreviousItem?: () => void;
  onNextItem?: () => void;
  onCompleteItem?: () => void;
  hasPreviousChangeRequest?: boolean;
  hasNextChangeRequest?: boolean;
  onPreviousChangeRequest?: () => void;
  onNextChangeRequest?: () => void;
  navigationLoading?: boolean;

  speakerLoading?: boolean;
  candidateLoading?: boolean;
  voteLoading?: boolean;

  onStartVote?: () => void;
  onStartFinalVote?: () => void;
  onCloseFinalVote?: () => void;
  onJumpToNextVoteStep?: () => void;
  onEditItem?: () => void;
  onDeleteItem?: () => void;
  onMoveToEvent?: () => void;
  onBackToAgenda?: () => void;
  onJoinSpeakerList?: () => void;
  onLeaveSpeakerList?: () => void;
  onBecomeCandidate?: () => void;
  onWithdrawCandidacy?: () => void;
  onVoteClick?: () => void;
  disableVoteButton?: boolean;
  disabledVoteTooltip?: string;
  showOfflineTallyButton?: boolean;
  onOfflineTallyClick?: () => void;
  offlineTallyMode?: 'create' | 'edit';
  offlineTallyTooltip?: string;
  startVoteTooltip?: string;
  startFinalVoteTooltip?: string;
  closeVoteTooltip?: string;
  jumpToNextVoteStepTooltip?: string;
  castIndicativeVoteTooltip?: string;
  castFinalVoteTooltip?: string;
}
import { AgendaActionBarView } from './AgendaActionBarView';
export function AgendaActionBar({
  eventId,
  currentAgendaItem,
  currentItemLabel,
  currentItemTitle,
  onOpenCurrentItem,
  canManageAgenda,
  canVote,
  canBeCandidate,
  isUserInSpeakerList,
  isUserCandidate,
  hasPreviousItem,
  hasNextItem,
  hasStartableItem,
  canMoveToNextItem,
  isCurrentItemCompleted,
  onStartItem,
  onPreviousItem,
  onNextItem,
  onCompleteItem,
  hasPreviousChangeRequest,
  hasNextChangeRequest,
  onPreviousChangeRequest,
  onNextChangeRequest,
  navigationLoading,
  speakerLoading,
  candidateLoading,
  voteLoading,
  onStartVote,
  onStartFinalVote,
  onCloseFinalVote,
  onJumpToNextVoteStep,
  onEditItem,
  onDeleteItem,
  onMoveToEvent,
  onBackToAgenda,
  onJoinSpeakerList,
  onLeaveSpeakerList,
  onBecomeCandidate,
  onWithdrawCandidacy,
  onVoteClick,
  disableVoteButton,
  disabledVoteTooltip,
  showOfflineTallyButton,
  onOfflineTallyClick,
  offlineTallyMode,
  offlineTallyTooltip,
  startVoteTooltip,
  startFinalVoteTooltip,
  closeVoteTooltip,
  jumpToNextVoteStepTooltip,
  castIndicativeVoteTooltip,
  castFinalVoteTooltip,
}: AgendaActionBarProps) {
  const { t } = useTranslation();
  const isCurrentItemActive =
    currentAgendaItem?.status === 'in-progress' || currentAgendaItem?.status === 'active';
  const canStartCurrentItem =
    Boolean(currentAgendaItem) && !isCurrentItemActive && currentAgendaItem?.status !== 'completed';
  const showLifecycleControls = canManageAgenda;
  const showStartButton =
    showLifecycleControls && Boolean(onStartItem) && (canStartCurrentItem || !currentAgendaItem);

  const isElection = currentAgendaItem?.type === 'election' || !!currentAgendaItem?.election;
  const isVote =
    currentAgendaItem?.type === 'amendment' ||
    currentAgendaItem?.type === 'vote' ||
    !!currentAgendaItem?.vote;
  const isVotable = isElection || isVote;

  const votingPhase = currentAgendaItem?.voting_phase;
  const isPendingVote = votingPhase === 'pending';
  const isIndicationPhase = votingPhase === 'indication';
  const isFinalVotePhase = votingPhase === 'final';
  const isClosed = votingPhase === 'closed';
  const completeDisabled =
    !currentAgendaItem || Boolean(isCurrentItemCompleted) || Boolean(navigationLoading);
  const startDisabled =
    !canManageAgenda ||
    !onStartItem ||
    Boolean(navigationLoading) ||
    (!canStartCurrentItem && !hasStartableItem);
  const nextDisabled =
    !hasNextItem || !canMoveToNextItem || Boolean(navigationLoading) || !currentAgendaItem;
  const defaultVoteTooltip = isFinalVotePhase
    ? castFinalVoteTooltip || t('features.events.agenda.actions.castFinalVote')
    : castIndicativeVoteTooltip || t('features.events.agenda.actions.castIndicativeVote');
  const voteTooltip = !canVote
    ? t(
        'features.events.agenda.actions.voteRequiresActiveVotingRight',
        'Active Voting Rights are required to vote in this event.'
      )
    : disableVoteButton
      ? disabledVoteTooltip || defaultVoteTooltip
      : defaultVoteTooltip;
  const showStartFinalVoteButton =
    isVotable && !isClosed && isIndicationPhase && isCurrentItemActive && Boolean(onStartFinalVote);
  const showVoteButton = isVotable && isFinalVotePhase && Boolean(onVoteClick);
  return (
    <AgendaActionBarView
      eventId={eventId}
      currentAgendaItem={currentAgendaItem}
      currentItemLabel={currentItemLabel}
      currentItemTitle={currentItemTitle}
      onOpenCurrentItem={onOpenCurrentItem}
      canManageAgenda={canManageAgenda}
      canVote={canVote}
      canBeCandidate={canBeCandidate}
      isUserInSpeakerList={isUserInSpeakerList}
      isUserCandidate={isUserCandidate}
      hasPreviousItem={hasPreviousItem}
      hasNextItem={hasNextItem}
      hasStartableItem={hasStartableItem}
      canMoveToNextItem={canMoveToNextItem}
      isCurrentItemCompleted={isCurrentItemCompleted}
      onStartItem={onStartItem}
      onPreviousItem={onPreviousItem}
      onNextItem={onNextItem}
      onCompleteItem={onCompleteItem}
      hasPreviousChangeRequest={hasPreviousChangeRequest}
      hasNextChangeRequest={hasNextChangeRequest}
      onPreviousChangeRequest={onPreviousChangeRequest}
      onNextChangeRequest={onNextChangeRequest}
      navigationLoading={navigationLoading}
      speakerLoading={speakerLoading}
      candidateLoading={candidateLoading}
      voteLoading={voteLoading}
      onStartVote={onStartVote}
      onStartFinalVote={onStartFinalVote}
      onCloseFinalVote={onCloseFinalVote}
      onJumpToNextVoteStep={onJumpToNextVoteStep}
      onEditItem={onEditItem}
      onDeleteItem={onDeleteItem}
      onMoveToEvent={onMoveToEvent}
      onBackToAgenda={onBackToAgenda}
      onJoinSpeakerList={onJoinSpeakerList}
      onLeaveSpeakerList={onLeaveSpeakerList}
      onBecomeCandidate={onBecomeCandidate}
      onWithdrawCandidacy={onWithdrawCandidacy}
      onVoteClick={onVoteClick}
      disableVoteButton={disableVoteButton}
      disabledVoteTooltip={disabledVoteTooltip}
      showOfflineTallyButton={showOfflineTallyButton}
      onOfflineTallyClick={onOfflineTallyClick}
      offlineTallyMode={offlineTallyMode}
      offlineTallyTooltip={offlineTallyTooltip}
      startVoteTooltip={startVoteTooltip}
      startFinalVoteTooltip={startFinalVoteTooltip}
      closeVoteTooltip={closeVoteTooltip}
      jumpToNextVoteStepTooltip={jumpToNextVoteStepTooltip}
      castIndicativeVoteTooltip={castIndicativeVoteTooltip}
      castFinalVoteTooltip={castFinalVoteTooltip}
      t={t}
      isCurrentItemActive={isCurrentItemActive}
      canStartCurrentItem={canStartCurrentItem}
      showLifecycleControls={showLifecycleControls}
      showStartButton={showStartButton}
      isElection={isElection}
      isVote={isVote}
      isVotable={isVotable}
      votingPhase={votingPhase}
      isPendingVote={isPendingVote}
      isIndicationPhase={isIndicationPhase}
      isFinalVotePhase={isFinalVotePhase}
      isClosed={isClosed}
      completeDisabled={completeDisabled}
      startDisabled={startDisabled}
      nextDisabled={nextDisabled}
      defaultVoteTooltip={defaultVoteTooltip}
      voteTooltip={voteTooltip}
      showStartFinalVoteButton={showStartFinalVoteButton}
      showVoteButton={showVoteButton}
    />
  );
}
