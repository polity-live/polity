'use client';

import { useNavigate } from '@tanstack/react-router';
import {
  Plus,
  Vote,
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
  Loader2,
  ListOrdered,
  ArrowRightLeft,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ToolbarButton } from '@/features/shared/ui/ui/toolbar';
import { FixedAgendaToolbar } from './FixedAgendaToolbar';
import { cn } from '@/features/shared/utils/utils';

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
  onEditItem?: () => void;
  onDeleteItem?: () => void;
  onMoveToEvent?: () => void;
  onBackToAgenda?: () => void;
  onJoinSpeakerList?: () => void;
  onLeaveSpeakerList?: () => void;
  onBecomeCandidate?: () => void;
  onWithdrawCandidacy?: () => void;
  onVoteClick?: () => void;
  startVoteTooltip?: string;
  startFinalVoteTooltip?: string;
  closeVoteTooltip?: string;
  castIndicativeVoteTooltip?: string;
  castFinalVoteTooltip?: string;
}

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
  onEditItem,
  onDeleteItem,
  onMoveToEvent,
  onBackToAgenda,
  onJoinSpeakerList,
  onLeaveSpeakerList,
  onBecomeCandidate,
  onWithdrawCandidacy,
  onVoteClick,
  startVoteTooltip,
  startFinalVoteTooltip,
  closeVoteTooltip,
  castIndicativeVoteTooltip,
  castFinalVoteTooltip,
}: AgendaActionBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCurrentItemActive =
    currentAgendaItem?.status === 'in-progress' || currentAgendaItem?.status === 'active';
  const canStartCurrentItem =
    Boolean(currentAgendaItem) && !isCurrentItemActive && currentAgendaItem?.status !== 'completed';
  const showStartButton = Boolean(onStartItem) && (canStartCurrentItem || !currentAgendaItem);

  const isElection = currentAgendaItem?.type === 'election' || !!currentAgendaItem?.election;
  const isVote =
    currentAgendaItem?.type === 'amendment' ||
    currentAgendaItem?.type === 'vote' ||
    !!currentAgendaItem?.vote;
  const isVotable = isElection || isVote;

  const votingPhase = currentAgendaItem?.voting_phase;
  const isPendingVote = votingPhase === 'pending';
  const isIndicationPhase = votingPhase === 'indication';
  const isFinalVotePhase = votingPhase === 'final_vote';
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
  const voteTooltip = isFinalVotePhase
    ? castFinalVoteTooltip || t('features.events.agenda.actions.castFinalVote', 'Cast Final Vote')
    : castIndicativeVoteTooltip ||
      t('features.events.agenda.actions.castIndicativeVote', 'Cast Indication');

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
            tooltip={t('features.agendas.crTimeline.previous', 'Previous Change Request')}
            onClick={onPreviousChangeRequest}
            disabled={!hasPreviousChangeRequest}
          >
            <ChevronLeft />
          </ToolbarButton>
        ) : null}
        {canManageAgenda && onNextChangeRequest ? (
          <ToolbarButton
            tooltip={t('features.agendas.crTimeline.next', 'Next Change Request')}
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
            tooltip={
              startVoteTooltip || t('features.events.agenda.actions.startVote', 'Start Vote')
            }
            onClick={onStartVote}
          >
            <Play />
          </ToolbarButton>
        ) : null}
        {canManageAgenda &&
        isVotable &&
        !isClosed &&
        isIndicationPhase &&
        isCurrentItemActive &&
        onStartFinalVote ? (
          <ToolbarButton
            tooltip={
              startFinalVoteTooltip ||
              t('features.events.agenda.actions.startFinalVote', 'Start Final Vote')
            }
            onClick={onStartFinalVote}
          >
            <Gavel />
          </ToolbarButton>
        ) : null}
        {canManageAgenda && isVotable && !isClosed && isFinalVotePhase && onCloseFinalVote ? (
          <ToolbarButton
            tooltip={
              closeVoteTooltip ||
              t('features.events.agenda.actions.closeFinalVote', 'Close Final Vote')
            }
            onClick={onCloseFinalVote}
          >
            <CheckCircle2 />
          </ToolbarButton>
        ) : null}
        {currentAgendaItem && !isUserInSpeakerList && onJoinSpeakerList ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.joinSpeakerList', 'Join Speaker List')}
            onClick={onJoinSpeakerList}
            disabled={speakerLoading}
          >
            {speakerLoading ? <Loader2 className="animate-spin" /> : <Mic />}
          </ToolbarButton>
        ) : null}
        {currentAgendaItem && isUserInSpeakerList && onLeaveSpeakerList ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.leaveSpeakerList', 'Leave Speaker List')}
            onClick={onLeaveSpeakerList}
            disabled={speakerLoading}
          >
            {speakerLoading ? <Loader2 className="animate-spin" /> : <MicOff />}
          </ToolbarButton>
        ) : null}
        {isElection && canBeCandidate && !isUserCandidate && onBecomeCandidate ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.becomeCandidate', 'Become Candidate')}
            onClick={onBecomeCandidate}
            disabled={candidateLoading}
          >
            {candidateLoading ? <Loader2 className="animate-spin" /> : <UserPlus />}
          </ToolbarButton>
        ) : null}
        {isElection && canBeCandidate && isUserCandidate && onWithdrawCandidacy ? (
          <ToolbarButton
            tooltip={t('features.events.agenda.actions.withdrawCandidacy', 'Withdraw Candidacy')}
            onClick={onWithdrawCandidacy}
            disabled={candidateLoading}
          >
            {candidateLoading ? <Loader2 className="animate-spin" /> : <UserMinus />}
          </ToolbarButton>
        ) : null}
        {isVotable && canVote && !isClosed && !isPendingVote && onVoteClick ? (
          <ToolbarButton
            tooltip={voteTooltip}
            onClick={onVoteClick}
            disabled={voteLoading}
            className={cn(
              'bg-background border px-3 font-semibold shadow-sm transition-all',
              'border-fuchsia-300 text-fuchsia-700 hover:border-fuchsia-400 hover:bg-fuchsia-50 hover:text-fuchsia-800',
              'animate-pulse'
            )}
          >
            {voteLoading ? <Loader2 className="animate-spin" /> : <Vote />}
            <span>Vote</span>
          </ToolbarButton>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
        {onPreviousItem ? (
          <ToolbarButton
            tooltip={t('features.events.navigation.previous', 'Previous')}
            onClick={onPreviousItem}
            disabled={!hasPreviousItem || navigationLoading}
          >
            {navigationLoading ? <Loader2 className="animate-spin" /> : <ChevronLeft />}
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
            <span className="truncate">{currentItemLabel || 'TOP'}</span>
          </ToolbarButton>
        ) : null}
        {showStartButton ? (
          <ToolbarButton
            tooltip={t('features.events.navigation.start', 'Start')}
            onClick={onStartItem}
            disabled={startDisabled}
            className="border border-emerald-300 text-emerald-700"
          >
            {navigationLoading ? <Loader2 className="animate-spin" /> : <Play />}
          </ToolbarButton>
        ) : null}
        {currentAgendaItem && isCurrentItemActive && onCompleteItem ? (
          <ToolbarButton
            tooltip={t('features.events.navigation.complete', 'Complete')}
            onClick={onCompleteItem}
            disabled={completeDisabled}
            className={cn(
              isCurrentItemCompleted
                ? 'border border-emerald-500 bg-emerald-500/10 text-emerald-700'
                : 'border border-emerald-300 text-emerald-700'
            )}
          >
            {navigationLoading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          </ToolbarButton>
        ) : null}
        {onNextItem ? (
          <ToolbarButton
            tooltip={t('features.events.navigation.next', 'Next')}
            onClick={onNextItem}
            disabled={nextDisabled}
          >
            {navigationLoading ? <Loader2 className="animate-spin" /> : <ChevronRight />}
          </ToolbarButton>
        ) : null}
      </div>
    </FixedAgendaToolbar>
  );
}
