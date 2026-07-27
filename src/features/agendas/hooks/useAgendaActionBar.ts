import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { useUserState } from '@/zero/users/useUserState';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useVoteCasting } from '@/features/vote-cast/hooks/useVoteCasting';
import { VOTE_PHASE } from '@/zero/votes/vote-workflow';
import {
  defaultElectionBallotVisibility,
  defaultVoteBallotVisibility,
  isNamedBallot,
} from '@/zero/shared';
import type { CandidacyPasswordDialogMode } from '@/features/elections/ui/CandidacyPasswordDialog';
import {
  createElectionFlowCorrelationId,
  logElectionFlowClient,
  logElectionFlowClientError,
} from '@/features/elections/logic/electionFlowLogging';
import { canJoinEventSpeakerList } from '../logic/speakerListPermissions';
import {
  getGenderQuotaFeedbackMessage,
  validateSpeakerGenderQuota,
} from '../logic/speakerListGenderQuota';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { gatedToast as toast } from '@/features/notifications/utils/gated-toast';
import { waitForClientApply } from '@/zero/mutate-with-server-check';
import { localizeAppError } from '@/features/shared/errors/app-error';

interface AgendaItem {
  id: string;
  type: string | null;
  status: string | null;
  voting_phase?: string | null;
  speaker_list?: readonly {
    readonly id: string;
    readonly user_id?: string | null;
    readonly user?: { readonly id: string; readonly gender?: string | null } | null;
    readonly order?: number | null;
    readonly order_index?: number | null;
    readonly created_at?: number | string | null;
    readonly completed?: boolean | null;
  }[];
}

interface ElectionCandidateLike {
  id: string;
  user_id?: string | null;
  user?: { id: string } | null;
}

interface ElectionLike {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
  majority_type?: string | null;
  closing_duration_seconds?: number | null;
  role?: { title?: string | null; name?: string | null; description?: string | null } | null;
  candidates?: readonly ElectionCandidateLike[] | null;
  indicative_participations?:
    | readonly {
        elector_id?: string | null;
        user_id?: string | null;
      }[]
    | null;
}

interface VoteLike {
  id: string;
  status?: string | null;
  visibility?: string | null;
  ballot_visibility?: string | null;
  closing_duration_seconds?: number | null;
  indicative_participations?:
    | readonly {
        voter_id?: string | null;
        user_id?: string | null;
      }[]
    | null;
}

interface UseAgendaActionBarOptions {
  eventId: string;
  currentAgendaItem?: AgendaItem | null;
  eventTitle?: string | null;
  /** Minimal election payload needed by the shared agenda toolbar */
  election?: ElectionLike | null;
  /** Minimal vote payload needed by the shared agenda toolbar */
  vote?: VoteLike | null;
  /** User's elector record id */
  electorId?: string;
  /** User's voter record id */
  voterId?: string;
  eventGenderQuotaEnabled?: boolean;
}

export function useAgendaActionBar(options: UseAgendaActionBarOptions) {
  const {
    eventId,
    currentAgendaItem,
    eventTitle,
    election,
    vote,
    electorId,
    voterId,
    eventGenderQuotaEnabled,
  } = options;
  const { user } = useAuth();
  const { currentUser } = useUserState();
  const { t } = useTranslation();
  const { can, canVote, canBeCandidate } = usePermissions({ eventId });

  const canManageAgenda = can('manage', 'agendaItems');
  const canManageSpeakers = can('manage_speakers', 'events');
  const canJoinSpeakerList = canJoinEventSpeakerList(can);
  const hasVotingRight = canVote();
  const hasCandidateRight = canBeCandidate();

  const { addSpeaker, removeSpeaker, updateAgendaItem } = useAgendaActions();
  const electionActions = useElectionActions();
  const voteActionsHook = useVoteActions();
  const { verifyVotingPassword } = useVotingPasswordActions();

  const [speakerLoading, setSpeakerLoading] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [candidacyDialogOpen, setCandidacyDialogOpen] = useState(false);
  const [candidacyDialogMode, setCandidacyDialogMode] =
    useState<CandidacyPasswordDialogMode>('become');
  const [candidacyPasswordError, setCandidacyPasswordError] = useState<string | null>(null);

  // Vote casting hook
  const voteCasting = useVoteCasting({
    agendaItemId: currentAgendaItem?.id ?? '',
    electionId: election?.id,
    voteId: vote?.id,
    eventId,
    status: currentAgendaItem?.voting_phase ?? election?.status ?? vote?.status,
    electorId,
    voterId,
    ballotVisibility: election?.ballot_visibility ?? vote?.ballot_visibility ?? null,
  });

  // Speaker list membership (only active / not-completed entries block rejoining)
  const isUserInSpeakerList = useMemo(() => {
    if (!user?.id || !currentAgendaItem?.speaker_list) return false;
    return currentAgendaItem.speaker_list.some(
      s => (s.user?.id === user.id || s.user_id === user.id) && !s.completed
    );
  }, [user?.id, currentAgendaItem?.speaker_list]);

  const userCandidate = useMemo(() => {
    if (!user?.id || !election?.candidates) return null;
    return (
      election.candidates.find(
        (c: { user_id?: string | null; user?: { id: string } | null }) =>
          c.user?.id === user.id || c.user_id === user.id
      ) ?? null
    );
  }, [user?.id, election?.candidates]);

  // Candidate status
  const isUserCandidate = useMemo(() => Boolean(userCandidate), [userCandidate]);
  const hasUserIndicativeParticipation = useMemo(() => {
    if (election?.id && user?.id) {
      return (
        election.indicative_participations?.some(
          participation =>
            participation.user_id === user.id ||
            (!participation.user_id && participation.elector_id === electorId)
        ) ?? false
      );
    }

    if (vote?.id && user?.id) {
      return (
        vote.indicative_participations?.some(
          participation =>
            participation.user_id === user.id ||
            (!participation.user_id && participation.voter_id === voterId)
        ) ?? false
      );
    }

    return false;
  }, [
    election?.id,
    election?.indicative_participations,
    electorId,
    user?.id,
    vote?.id,
    vote?.indicative_participations,
    voterId,
  ]);
  const isSecretBallot = election?.id
    ? !isNamedBallot(election.ballot_visibility ?? defaultElectionBallotVisibility)
    : vote?.id
      ? !isNamedBallot(vote.ballot_visibility ?? defaultVoteBallotVisibility)
      : false;
  const disableSecretIndicativeVoteButton =
    voteCasting.isIndicationPhase && isSecretBallot && hasUserIndicativeParticipation;
  const secretIndicativeVoteTooltip = disableSecretIndicativeVoteButton
    ? t('features.events.agenda.actions.secretIndicativeVoteAlreadyCast')
    : null;

  const performBecomeCandidate = useCallback(async () => {
    if (!user?.id || !election?.id || !hasCandidateRight) return;

    const candidateOrder = (election.candidates?.length ?? 0) + 1;
    await waitForClientApply(
      electionActions.addCandidate({
        id: crypto.randomUUID(),
        name: user.email || t('features.events.agenda.candidate'),
        description: '',
        image_url: '',
        order_index: candidateOrder,
        status: 'nominated',
        user_id: user.id,
        election_id: election.id,
      })
    );
  }, [
    user?.id,
    user?.email,
    election?.id,
    election?.candidates?.length,
    hasCandidateRight,
    electionActions,
    t,
  ]);

  const performWithdrawCandidacy = useCallback(async () => {
    if (!user?.id || !userCandidate) return;
    await waitForClientApply(electionActions.deleteCandidate(userCandidate.id));
  }, [user?.id, userCandidate, electionActions]);

  const handleCandidacyDialogOpenChange = useCallback((open: boolean) => {
    setCandidacyDialogOpen(open);
    if (!open) {
      setCandidacyPasswordError(null);
    }
  }, []);

  const handleCandidacyPasswordSubmit = useCallback(
    async (password: string) => {
      setCandidateLoading(true);
      setCandidacyPasswordError(null);

      try {
        await verifyVotingPassword(password);

        if (candidacyDialogMode === 'withdraw') {
          await performWithdrawCandidacy();
        } else {
          await performBecomeCandidate();
        }

        setCandidacyDialogOpen(false);
      } catch (error) {
        const message = localizeAppError(error);
        setCandidacyPasswordError(message);
      } finally {
        setCandidateLoading(false);
      }
    },
    [candidacyDialogMode, performBecomeCandidate, performWithdrawCandidacy, verifyVotingPassword]
  );

  const openCandidacyDialog = useCallback((mode: CandidacyPasswordDialogMode) => {
    setCandidacyDialogMode(mode);
    setCandidacyPasswordError(null);
    setCandidacyDialogOpen(true);
  }, []);

  // Handlers
  const handleJoinSpeakerList = useCallback(async () => {
    if (!user?.id || !currentAgendaItem?.id || !canJoinSpeakerList) return;

    const quotaResult = validateSpeakerGenderQuota({
      enabled: Boolean(eventGenderQuotaEnabled && currentUser),
      speakerGender: currentUser?.gender ?? null,
      speakers: currentAgendaItem.speaker_list ?? [],
    });

    if (!quotaResult.allowed) {
      toast.error(getGenderQuotaFeedbackMessage(quotaResult, t));
      return;
    }

    setSpeakerLoading(true);
    try {
      await waitForClientApply(
        addSpeaker({
          id: crypto.randomUUID(),
          agenda_item_id: currentAgendaItem.id,
          user_id: user.id,
          title: null,
          order_index: (currentAgendaItem.speaker_list?.length ?? 0) + 1,
          time: 3,
          completed: false,
          start_time: null,
          end_time: null,
        })
      );
    } catch {
      // toast handled in useAgendaActions
    } finally {
      setSpeakerLoading(false);
    }
  }, [
    user?.id,
    currentUser?.gender,
    currentAgendaItem?.id,
    currentAgendaItem?.speaker_list,
    canJoinSpeakerList,
    eventGenderQuotaEnabled,
    addSpeaker,
    t,
  ]);

  const handleLeaveSpeakerList = useCallback(async () => {
    if (!user?.id || !currentAgendaItem?.speaker_list) return;
    const userSpeaker = currentAgendaItem.speaker_list.find(
      s => (s.user?.id === user.id || s.user_id === user.id) && !s.completed
    );
    if (!userSpeaker) return;
    setSpeakerLoading(true);
    try {
      await waitForClientApply(removeSpeaker(userSpeaker.id));
    } catch {
      // toast handled in useAgendaActions
    } finally {
      setSpeakerLoading(false);
    }
  }, [user?.id, currentAgendaItem?.speaker_list, removeSpeaker]);

  const handleBecomeCandidate = useCallback(async () => {
    if (!user?.id || !election?.id || !hasCandidateRight) return;
    openCandidacyDialog('become');
  }, [user?.id, election?.id, hasCandidateRight, openCandidacyDialog]);

  const handleWithdrawCandidacy = useCallback(async () => {
    if (!user?.id || !userCandidate) return;
    openCandidacyDialog('withdraw');
  }, [user?.id, userCandidate, openCandidacyDialog]);

  const handleStartVote = useCallback(async () => {
    if (!canManageAgenda) return;
    if (election?.id) {
      await waitForClientApply(
        electionActions.updateElection({
          id: election.id,
          status: 'indicative',
          closing_end_time: null,
        })
      );
    } else if (vote?.id) {
      await waitForClientApply(
        voteActionsHook.updateVote({
          id: vote.id,
          status: VOTE_PHASE.indicative,
          closing_end_time: null,
        })
      );
    }

    if (currentAgendaItem?.id) {
      await waitForClientApply(
        updateAgendaItem({
          id: currentAgendaItem.id,
          voting_phase: 'indicative',
        })
      );
    }
  }, [
    canManageAgenda,
    currentAgendaItem?.id,
    election,
    vote,
    electionActions,
    voteActionsHook,
    updateAgendaItem,
  ]);

  const handleStartFinalVote = useCallback(async () => {
    if (!canManageAgenda) return;
    if (election?.id) {
      await waitForClientApply(
        electionActions.updateElection({
          id: election.id,
          status: 'final',
          closing_end_time: election.closing_duration_seconds
            ? Date.now() + election.closing_duration_seconds * 1000
            : null,
        })
      );
    } else if (vote?.id) {
      await waitForClientApply(
        voteActionsHook.updateVote({
          id: vote.id,
          status: VOTE_PHASE.final,
          closing_end_time: vote.closing_duration_seconds
            ? Date.now() + vote.closing_duration_seconds * 1000
            : null,
        })
      );
    }

    if (currentAgendaItem?.id) {
      await waitForClientApply(
        updateAgendaItem({
          id: currentAgendaItem.id,
          voting_phase: 'final',
        })
      );
    }
  }, [
    canManageAgenda,
    currentAgendaItem?.id,
    election,
    vote,
    electionActions,
    voteActionsHook,
    updateAgendaItem,
  ]);

  const handleCloseFinalVote = useCallback(async () => {
    if (!canManageAgenda) return;
    const flow = election?.id ? 'election-close-final-vote' : 'vote-close-final-vote';
    const correlationId = createElectionFlowCorrelationId(flow);

    logElectionFlowClient(flow, 'submit-started', {
      correlationId,
      eventId,
      agendaItemId: currentAgendaItem?.id ?? null,
      electionId: election?.id ?? null,
      voteId: vote?.id ?? null,
    });

    try {
      if (election?.id) {
        await waitForClientApply(
          electionActions.updateElection({
            id: election.id,
            status: 'closed',
            debug_correlation_id: correlationId,
          })
        );
      } else if (vote?.id) {
        await waitForClientApply(voteActionsHook.updateVote({ id: vote.id, status: 'closed' }));
      }

      if (currentAgendaItem?.id) {
        await waitForClientApply(
          updateAgendaItem({
            id: currentAgendaItem.id,
            voting_phase: 'closed',
          })
        );
      }

      logElectionFlowClient(flow, 'submit-confirmed', {
        correlationId,
        agendaItemId: currentAgendaItem?.id ?? null,
        electionId: election?.id ?? null,
        voteId: vote?.id ?? null,
      });
    } catch (error) {
      logElectionFlowClientError(flow, 'submit-failed', {
        correlationId,
        agendaItemId: currentAgendaItem?.id ?? null,
        electionId: election?.id ?? null,
        voteId: vote?.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [
    canManageAgenda,
    currentAgendaItem?.id,
    election,
    eventId,
    updateAgendaItem,
    vote,
    electionActions,
    voteActionsHook,
  ]);

  const handleVoteClick = useCallback(() => {
    setVoteDialogOpen(true);
  }, []);

  const handleEditClick = useCallback(() => {
    setEditDialogOpen(true);
  }, []);

  return {
    // Permissions
    canManageAgenda,
    canManageSpeakers,
    canJoinSpeakerList,
    hasVotingRight,
    hasCandidateRight,

    // State
    isUserInSpeakerList,
    isUserCandidate,
    speakerLoading,
    candidateLoading,
    voteDialogOpen,
    setVoteDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    candidacyDialogProps: {
      open: candidacyDialogOpen,
      mode: candidacyDialogMode,
      electionTitle: election?.title ?? eventTitle ?? null,
      electionDescription: election?.description ?? null,
      roleTitle: election?.role?.title ?? election?.role?.name ?? null,
      candidatesCount: election?.candidates?.length ?? null,
      majorityType: election?.majority_type ?? null,
      error: candidacyPasswordError,
      isSubmitting: candidateLoading,
      onOpenChange: handleCandidacyDialogOpenChange,
      onSubmit: handleCandidacyPasswordSubmit,
    },

    // Vote casting (for dialog)
    voteCasting,
    disableSecretIndicativeVoteButton,
    secretIndicativeVoteTooltip,

    // Handlers
    handleJoinSpeakerList,
    handleLeaveSpeakerList,
    handleBecomeCandidate,
    handleWithdrawCandidacy,
    handleStartVote,
    handleStartFinalVote,
    handleCloseFinalVote,
    handleVoteClick,
    handleEditClick,
  };
}
