'use client';

import { featureThemeClassName } from '@/features/shared/theme';
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
import { ToolbarButton } from '@/features/shared/ui/layout';
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
  castIndicativeVoteTooltip: any;
  castFinalVoteTooltip: any;
  t: any;
  navigate: any;
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
  t,
  navigate,
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
}: AgendaActionBarViewProps) {
  const candidateTooltip = canBeCandidate
    ? t('features.events.agenda.actions.becomeCandidate')
    : t(
        'features.events.agenda.actions.candidateRequiresPassiveVotingRight',
        'Passive Voting Rights are required to become a candidate in this event.'
      );
  const isCandidateActionBlocked = !canBeCandidate;
  const isVoteActionBlocked = !canVote || disableVoteButton;

  return (
    <FixedAgendaToolbar className="gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {onBackToAgenda ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.backToAgenda')}
            onClick={onBackToAgenda}
          >
            <ListOrdered />
          </ToolbarButton>
        ) : null}
        {canManageAgenda && onMoveToEvent ? (
          <ToolbarButton tooltip={t('features.events.agenda.moveToEvent')} onClick={onMoveToEvent}>
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
            <ToolbarButton
              tooltip={t('features.events.agenda.quickActions.addItem')}
              onClick={() => navigate({ to: '/create/agenda-item', search: { eventId } })}
            >
              <Plus />
            </ToolbarButton>
            <ToolbarButton
              tooltip={t('features.events.agenda.quickActions.createElection')}
              onClick={() =>
                navigate({ to: '/create/agenda-item', search: { eventId, type: 'election' } })
              }
            >
              <Vote />
            </ToolbarButton>
            <ToolbarButton
              tooltip={t('features.events.agenda.quickActions.createVote')}
              onClick={() =>
                navigate({ to: '/create/agenda-item', search: { eventId, type: 'vote' } })
              }
            >
              <Gavel />
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

      <div className="flex items-center justify-center gap-1">
        {canManageAgenda && isVotable && !isClosed && isPendingVote && onStartVote ? (
          <ToolbarButton
            tooltip={startVoteTooltip || t('features.events.agenda.actions.startVote')}
            onClick={onStartVote}
          >
            <Play />
          </ToolbarButton>
        ) : null}
        {showStartFinalVoteButton ? (
          <ToolbarButton
            tooltip={startFinalVoteTooltip || t('features.events.agenda.actions.startFinalVote')}
            onClick={onStartFinalVote}
          >
            <Gavel />
          </ToolbarButton>
        ) : null}
        {canManageAgenda && isVotable && !isClosed && isFinalVotePhase && onCloseFinalVote ? (
          <ToolbarButton
            tooltip={closeVoteTooltip || t('features.events.agenda.actions.closeFinalVote')}
            onClick={onCloseFinalVote}
          >
            <CheckCircle2 />
          </ToolbarButton>
        ) : null}
        {currentAgendaItem && !isUserInSpeakerList && onJoinSpeakerList ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.joinSpeakerList')}
            onClick={onJoinSpeakerList}
            disabled={speakerLoading}
            loading={speakerLoading}
          >
            <Mic />
          </ToolbarButton>
        ) : null}
        {currentAgendaItem && isUserInSpeakerList && onLeaveSpeakerList ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.leaveSpeakerList')}
            onClick={onLeaveSpeakerList}
            disabled={speakerLoading}
            loading={speakerLoading}
          >
            <MicOff />
          </ToolbarButton>
        ) : null}
        {isElection && !isClosed && !isUserCandidate && onBecomeCandidate ? (
          <ToolbarButton
            tooltip={candidateTooltip}
            onClick={isCandidateActionBlocked ? undefined : onBecomeCandidate}
            disabled={candidateLoading}
            loading={candidateLoading}
            aria-disabled={isCandidateActionBlocked || undefined}
            aria-label={candidateTooltip}
            className={cn(
              isCandidateActionBlocked &&
                'border-muted-foreground/30 text-muted-foreground border opacity-70'
            )}
          >
            <UserPlus />
            {isCandidateActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
          </ToolbarButton>
        ) : null}
        {isElection && canBeCandidate && isUserCandidate && onWithdrawCandidacy ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.withdrawCandidacy')}
            onClick={onWithdrawCandidacy}
            disabled={candidateLoading}
            loading={candidateLoading}
          >
            <UserMinus />
          </ToolbarButton>
        ) : null}
        {isVotable && !isClosed && onVoteClick ? (
          <ToolbarButton
            tooltip={voteTooltip}
            onClick={isVoteActionBlocked ? undefined : onVoteClick}
            disabled={voteLoading}
            loading={voteLoading}
            aria-disabled={isVoteActionBlocked || undefined}
            className={cn(
              'civic-ballot-submit',
              'bg-background border px-3 font-semibold shadow-sm transition-all',
              isVoteActionBlocked
                ? 'border-muted-foreground/30 text-muted-foreground opacity-70'
                : featureThemeClassName('agendaAgendaActionBarAccentBadge')
            )}
          >
            <Vote />
            <span>{translateText('generated.inline.0011_vote_64f87291')}</span>
            {isVoteActionBlocked ? <CircleHelp className="h-4 w-4" /> : null}
          </ToolbarButton>
        ) : null}
        {!isClosed && !isPendingVote && (showOfflineTallyButton || onOfflineTallyClick) ? (
          <ToolbarButton
            tooltip={offlineTallyTooltip || 'Manage offline tally'}
            onClick={onOfflineTallyClick}
            disabled={!onOfflineTallyClick}
            className={featureThemeClassName('agendaAgendaActionBarInfoBorder')}
          >
            {offlineTallyMode === 'edit' ? <PencilLine /> : <FileEdit />}
            <span>{translateText('generated.inline.0012_enter_tally_70132614')}</span>
          </ToolbarButton>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
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
            className={featureThemeClassName('agendaAgendaActionBarSuccessBorder')}
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
                ? featureThemeClassName('agendaAgendaActionBarSuccessBadge')
                : featureThemeClassName('agendaAgendaActionBarSuccessBorder')
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
    </FixedAgendaToolbar>
  );
}
