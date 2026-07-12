'use client';

import { Link } from '@tanstack/react-router';
import {
  Plus,
  Vote,
  CircleHelp,
  Gavel,
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Edit,
  Trash2,
  Mic,
  MicOff,
  UserPlus,
  UserMinus,
  ListOrdered,
  ArrowRightLeft,
  FileEdit,
  PencilLine,
} from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { ToolbarButton, ToolbarSeparator } from '@/features/shared/ui/layout';
import { FixedAgendaToolbar } from './FixedAgendaToolbar';
import { cn } from '@/features/shared/utils/utils';
export interface AgendaActionBarViewProps {
  eventId: any;
  currentAgendaItem: any;
  currentItemLabel: any;
  currentItemTitle: any;
  onOpenCurrentItem: any;
  canManageAgenda: any;
  canVote: any;
  canBeCandidate: any;
  isUserInSpeakerList: any;
  isUserCandidate: any;
  hasPreviousItem: any;
  hasNextItem: any;
  hasStartableItem: any;
  canMoveToNextItem: any;
  isCurrentItemCompleted: any;
  onStartItem: any;
  onPreviousItem: any;
  onNextItem: any;
  onCompleteItem: any;
  hasPreviousChangeRequest: any;
  hasNextChangeRequest: any;
  onPreviousChangeRequest: any;
  onNextChangeRequest: any;
  navigationLoading: any;
  speakerLoading: any;
  candidateLoading: any;
  voteLoading: any;
  onStartVote: any;
  onStartFinalVote: any;
  onCloseFinalVote: any;
  onJumpToNextVoteStep: any;
  onEditItem: any;
  onDeleteItem: any;
  onMoveToEvent: any;
  onBackToAgenda: any;
  onJoinSpeakerList: any;
  onLeaveSpeakerList: any;
  onBecomeCandidate: any;
  onWithdrawCandidacy: any;
  onVoteClick: any;
  disableVoteButton: any;
  disabledVoteTooltip: any;
  showOfflineTallyButton: any;
  onOfflineTallyClick: any;
  offlineTallyMode: any;
  offlineTallyTooltip: any;
  startVoteTooltip: any;
  startFinalVoteTooltip: any;
  closeVoteTooltip: any;
  jumpToNextVoteStepTooltip: any;
  castIndicativeVoteTooltip: any;
  castFinalVoteTooltip: any;
  t: any;
  isCurrentItemActive: any;
  canStartCurrentItem: any;
  showStartButton: any;
  isElection: any;
  isVote: any;
  isVotable: any;
  votingPhase: any;
  isPendingVote: any;
  isIndicationPhase: any;
  isFinalVotePhase: any;
  isClosed: any;
  completeDisabled: any;
  startDisabled: any;
  nextDisabled: any;
  defaultVoteTooltip: any;
  voteTooltip: any;
  showLifecycleControls: any;
  showStartFinalVoteButton: any;
  showVoteButton: any;
}

export function AgendaActionBarView({
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
  showOfflineTallyButton,
  onOfflineTallyClick,
  offlineTallyMode,
  offlineTallyTooltip,
  startVoteTooltip,
  startFinalVoteTooltip,
  closeVoteTooltip,
  jumpToNextVoteStepTooltip,
  t,
  isCurrentItemActive,
  showStartButton,
  isElection,
  isVotable,
  isPendingVote,
  isFinalVotePhase,
  isClosed,
  completeDisabled,
  startDisabled,
  nextDisabled,
  voteTooltip,
  showLifecycleControls,
  showStartFinalVoteButton,
  showVoteButton,
}: AgendaActionBarViewProps) {
  const candidateTooltip = canBeCandidate
    ? t('features.events.agenda.actions.becomeCandidate')
    : t(
        'features.events.agenda.actions.candidateRequiresPassiveVotingRight',
        'Passive Voting Rights are required to become a candidate in this event.'
      );
  const isCandidateActionBlocked = !canBeCandidate;
  const isVoteActionBlocked = !canVote || disableVoteButton;
  const startVoteActionLabel = startVoteTooltip || t('features.events.agenda.actions.startVote');
  const startFinalVoteActionLabel =
    startFinalVoteTooltip || t('features.events.agenda.actions.startFinalVote');
  const closeFinalVoteActionLabel =
    closeVoteTooltip || t('features.events.agenda.actions.closeFinalVote');
  const showJoinSpeakerAction = Boolean(
    currentAgendaItem && !isUserInSpeakerList && onJoinSpeakerList
  );
  const showLeaveSpeakerAction = Boolean(
    currentAgendaItem && isUserInSpeakerList && onLeaveSpeakerList
  );
  const showBecomeCandidateAction = Boolean(
    isElection && !isClosed && !isUserCandidate && onBecomeCandidate
  );
  const showWithdrawCandidateAction = Boolean(
    isElection && canBeCandidate && isUserCandidate && onWithdrawCandidacy
  );
  const showOfflineTallyAction = Boolean(
    !isClosed && !isPendingVote && (showOfflineTallyButton || onOfflineTallyClick)
  );
  const showContextGroup = Boolean(onBackToAgenda || canManageAgenda);
  const showVotingGroup = Boolean(
    (isVotable && onJumpToNextVoteStep) ||
    (isVotable && !isClosed && isPendingVote && onStartVote) ||
    showStartFinalVoteButton ||
    (isVotable && !isClosed && isFinalVotePhase && onCloseFinalVote) ||
    showJoinSpeakerAction ||
    showLeaveSpeakerAction ||
    showBecomeCandidateAction ||
    showWithdrawCandidateAction ||
    showVoteButton ||
    showOfflineTallyAction
  );
  const showNavigationGroup = Boolean(
    (showLifecycleControls && onPreviousItem) ||
    currentAgendaItem ||
    showStartButton ||
    (showLifecycleControls && currentAgendaItem && isCurrentItemActive && onCompleteItem) ||
    (showLifecycleControls && onNextItem)
  );

  return (
    <FixedAgendaToolbar
      className="scrollbar-hide grid auto-cols-max grid-flow-col items-stretch justify-start gap-0 overflow-x-auto md:flex md:justify-between"
      aria-label={t('features.events.agenda.actions.toolbar', 'Agenda controls')}
    >
      {showContextGroup ? (
        <div
          className="flex min-w-max items-center gap-1 px-1 md:min-w-0 md:flex-1 md:overflow-x-auto"
          data-agenda-toolbar-group="context"
        >
          {onBackToAgenda ? (
            <ToolbarButton asChild tooltip={t('features.events.agenda.backToAgenda')}>
              <Link to="/event/$id/agenda" params={{ id: eventId }}>
                <ListOrdered />
              </Link>
            </ToolbarButton>
          ) : null}
          {canManageAgenda && onMoveToEvent ? (
            <ToolbarButton
              tooltip={t('features.events.agenda.moveToEvent')}
              onClick={onMoveToEvent}
            >
              <ArrowRightLeft />
            </ToolbarButton>
          ) : null}
          {canManageAgenda && currentAgendaItem && onEditItem ? (
            <ToolbarButton tooltip={t('common.actions.edit')} onClick={onEditItem}>
              <Edit />
            </ToolbarButton>
          ) : null}
          {canManageAgenda && currentAgendaItem && onDeleteItem ? (
            <ToolbarButton tooltip={t('common.actions.delete')} onClick={onDeleteItem}>
              <Trash2 />
            </ToolbarButton>
          ) : null}
          {canManageAgenda ? (
            <>
              <ToolbarButton asChild tooltip={t('features.events.agenda.quickActions.addItem')}>
                <Link to="/create/agenda-item" search={{ eventId }}>
                  <Plus />
                </Link>
              </ToolbarButton>
              <ToolbarButton
                asChild
                tooltip={t('features.events.agenda.quickActions.createElection')}
              >
                <Link to="/create/agenda-item" search={{ eventId, type: 'election' }}>
                  <Vote />
                </Link>
              </ToolbarButton>
              <ToolbarButton asChild tooltip={t('features.events.agenda.quickActions.createVote')}>
                <Link to="/create/agenda-item" search={{ eventId, type: 'vote' }}>
                  <Gavel />
                </Link>
              </ToolbarButton>
            </>
          ) : null}
          {canManageAgenda && onPreviousChangeRequest ? (
            <ToolbarButton
              tooltip={t('features.agendas.crTimeline.previous')}
              onClick={onPreviousChangeRequest}
              disabled={!hasPreviousChangeRequest}
            >
              <ChevronLeft />
            </ToolbarButton>
          ) : null}
          {canManageAgenda && onNextChangeRequest ? (
            <ToolbarButton
              tooltip={t('features.agendas.crTimeline.next')}
              onClick={onNextChangeRequest}
              disabled={!hasNextChangeRequest}
            >
              <ChevronRight />
            </ToolbarButton>
          ) : null}
        </div>
      ) : null}

      {showContextGroup && showVotingGroup ? (
        <ToolbarSeparator data-agenda-toolbar-separator="context-voting" className="mx-1 my-2" />
      ) : null}

      {showVotingGroup ? (
        <div
          className="flex min-w-max items-center justify-center gap-1 px-1"
          data-agenda-toolbar-group="voting"
        >
          {isVotable && onJumpToNextVoteStep ? (
            <ToolbarButton
              tooltip={
                jumpToNextVoteStepTooltip ||
                t('features.agendas.crTimeline.nextVotingStep', 'Next voting step')
              }
              onClick={onJumpToNextVoteStep}
              disabled={voteLoading}
              loading={voteLoading}
            >
              <ChevronRight />
            </ToolbarButton>
          ) : null}
          {isVotable && !isClosed && isPendingVote && onStartVote ? (
            <ToolbarButton
              tooltip={startVoteActionLabel}
              aria-label={startVoteActionLabel}
              onClick={onStartVote}
              disabled={voteLoading}
              loading={voteLoading}
            >
              <Play />
            </ToolbarButton>
          ) : null}
          {showStartFinalVoteButton ? (
            <ToolbarButton
              tooltip={startFinalVoteActionLabel}
              aria-label={startFinalVoteActionLabel}
              onClick={onStartFinalVote}
              disabled={voteLoading}
              loading={voteLoading}
            >
              <Gavel />
            </ToolbarButton>
          ) : null}
          {isVotable && !isClosed && isFinalVotePhase && onCloseFinalVote ? (
            <ToolbarButton
              tooltip={closeFinalVoteActionLabel}
              aria-label={closeFinalVoteActionLabel}
              onClick={onCloseFinalVote}
            >
              <CheckCircle2 />
            </ToolbarButton>
          ) : null}
          {showJoinSpeakerAction ? (
            <ToolbarButton
              tooltip={t('features.events.agenda.actions.joinSpeakerList')}
              onClick={onJoinSpeakerList}
              disabled={speakerLoading}
              loading={speakerLoading}
            >
              <Mic />
            </ToolbarButton>
          ) : null}
          {showLeaveSpeakerAction ? (
            <ToolbarButton
              tooltip={t('features.events.agenda.actions.leaveSpeakerList')}
              onClick={onLeaveSpeakerList}
              disabled={speakerLoading}
              loading={speakerLoading}
            >
              <MicOff />
            </ToolbarButton>
          ) : null}
          {showBecomeCandidateAction ? (
            <ToolbarButton
              tooltip={candidateTooltip}
              onClick={isCandidateActionBlocked ? undefined : onBecomeCandidate}
              disabled={candidateLoading}
              loading={candidateLoading}
              aria-disabled={isCandidateActionBlocked || undefined}
              aria-label={candidateTooltip}
              className={cn(isCandidateActionBlocked && 'text-muted-foreground opacity-70')}
            >
              <UserPlus />
              {isCandidateActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
            </ToolbarButton>
          ) : null}
          {showWithdrawCandidateAction ? (
            <ToolbarButton
              tooltip={t('features.events.agenda.actions.withdrawCandidacy')}
              onClick={onWithdrawCandidacy}
              disabled={candidateLoading}
              loading={candidateLoading}
            >
              <UserMinus />
            </ToolbarButton>
          ) : null}
          {showVoteButton ? (
            <ToolbarButton
              tooltip={voteTooltip}
              onClick={isVoteActionBlocked ? undefined : onVoteClick}
              disabled={voteLoading}
              loading={voteLoading}
              aria-disabled={isVoteActionBlocked || undefined}
              className={cn(
                'civic-ballot-submit',
                'border-0 bg-transparent px-3 font-semibold shadow-none transition-all',
                isVoteActionBlocked
                  ? 'text-muted-foreground opacity-70'
                  : 'animate-pulse text-fuchsia-700 hover:bg-fuchsia-50 hover:text-fuchsia-800'
              )}
            >
              <Vote />
              <span>{translateText('generated.inline.0011_vote_64f87291')}</span>
              {isVoteActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
            </ToolbarButton>
          ) : null}
          {showOfflineTallyAction ? (
            <ToolbarButton
              tooltip={offlineTallyTooltip || t('features.events.agenda.manageOfflineTally')}
              onClick={onOfflineTallyClick}
              disabled={!onOfflineTallyClick}
              className="border-0 px-3 text-[var(--badge-info-fg)] shadow-none"
            >
              {offlineTallyMode === 'edit' ? <PencilLine /> : <FileEdit />}
              <span>{translateText('generated.inline.0012_enter_tally_70132614')}</span>
            </ToolbarButton>
          ) : null}
        </div>
      ) : null}

      {(showContextGroup || showVotingGroup) && showNavigationGroup ? (
        <ToolbarSeparator
          data-agenda-toolbar-separator="actions-navigation"
          className="mx-1 my-2"
        />
      ) : null}

      {showNavigationGroup ? (
        <div
          className="flex min-w-max items-center justify-end gap-1 px-1 md:min-w-0 md:flex-1 md:overflow-x-auto"
          data-agenda-toolbar-group="navigation"
        >
          {showLifecycleControls && onPreviousItem ? (
            <ToolbarButton
              tooltip={t('features.events.navigation.previous')}
              onClick={onPreviousItem}
              disabled={!hasPreviousItem || navigationLoading}
              loading={navigationLoading}
            >
              <ChevronLeft />
            </ToolbarButton>
          ) : null}
          {currentAgendaItem ? (
            <ToolbarButton
              tooltip={currentItemTitle || currentItemLabel || ''}
              onClick={onOpenCurrentItem}
              disabled={!onOpenCurrentItem}
              className="max-w-[220px] justify-start truncate px-3"
              title={currentItemTitle || currentItemLabel || undefined}
            >
              <span className="truncate">
                {currentItemLabel || translateText('generated.inline.0004_top_b48813fa')}
              </span>
            </ToolbarButton>
          ) : null}
          {showStartButton ? (
            <ToolbarButton
              tooltip={t('features.events.navigation.start')}
              onClick={onStartItem}
              disabled={startDisabled}
              loading={navigationLoading}
              className="border-0 text-[var(--badge-success-fg)] shadow-none hover:bg-[var(--badge-success-bg)]"
            >
              <Play />
            </ToolbarButton>
          ) : null}
          {showLifecycleControls && currentAgendaItem && isCurrentItemActive && onCompleteItem ? (
            <ToolbarButton
              tooltip={t('features.events.navigation.complete')}
              onClick={onCompleteItem}
              disabled={completeDisabled}
              loading={navigationLoading}
              successState={isCurrentItemCompleted}
              className={cn(
                isCurrentItemCompleted
                  ? 'border-0 bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)] shadow-none'
                  : 'border-0 text-[var(--badge-success-fg)] shadow-none hover:bg-[var(--badge-success-bg)]'
              )}
            >
              <CheckCircle2 />
            </ToolbarButton>
          ) : null}
          {showLifecycleControls && onNextItem ? (
            <ToolbarButton
              tooltip={t('features.events.navigation.next')}
              onClick={onNextItem}
              disabled={nextDisabled}
              loading={navigationLoading}
            >
              <ChevronRight />
            </ToolbarButton>
          ) : null}
        </div>
      ) : null}
    </FixedAgendaToolbar>
  );
}
