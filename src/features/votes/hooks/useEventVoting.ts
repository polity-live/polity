/**
 * useEventVoting Hook
 *
 * Manages structured voting at events including introduction phase,
 * voting phase, and result calculation.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useEventWithVoting } from '@/zero/events/useEventState';
import { useAgendaActions } from '@/zero/agendas';
import { useVoteActions } from '@/zero/votes/useVoteActions';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/zero/rbac';
import { toast } from 'sonner';
import { computeVoteResult, type MajorityType, type VoteResult } from '../logic/computeVoteResult';
import { computeEligibleVoters, type EligibleVoter } from '../logic/computeEligibleVoters';
import { isNamedBallot } from '@/zero/shared';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export type VotingPhase = 'introduction' | 'voting' | 'completed';
export type VotingType = 'amendment' | 'election' | 'change_request';
export type { MajorityType, VoteResult } from '../logic/computeVoteResult';
export type VoteValue = 'accept' | 'reject' | 'abstain';

interface VotingSession {
  id: string;
  phase: VotingPhase;
  votingType: VotingType;
  startedAt?: number;
  endedAt?: number;
  timeLimit?: number;
  autoCloseOnAllVoted?: boolean;
  autoCloseOnTimeout?: boolean;
  majorityType: MajorityType;
  result?: VoteResult;
  targetEntityType: string;
  targetEntityId: string;
  votes?: {
    id: string;
    vote: VoteValue;
    voter: { id: string; name?: string };
  }[];
}

interface UseEventVotingResult {
  currentSession: VotingSession | null;
  eligibleVoters: EligibleVoter[];
  votedCount: number;
  totalVoters: number;
  canVote: boolean;
  canManageVoting: boolean;
  hasUserVoted: boolean;
  userVote: VoteValue | null;
  voteResults: { accept: number; reject: number; abstain: number };
  isLoading: boolean;
  timeRemaining: number | null;
  startIntroductionPhase: (params: StartVotingParams) => Promise<string>;
  startVotingPhase: (sessionId: string, timeLimit?: number) => Promise<void>;
  closeVoting: (sessionId: string) => Promise<void>;
  castVote: (sessionId: string, vote: VoteValue) => Promise<void>;
}

interface StartVotingParams {
  agendaItemId: string;
  votingType: VotingType;
  targetEntityId: string;
  majorityType?: MajorityType;
  autoCloseOnAllVoted?: boolean;
}

export function useEventVoting(eventId: string, agendaItemId?: string): UseEventVotingResult {
  const { user } = useAuth();
  const { updateAgendaItem } = useAgendaActions();
  const { createVote, updateVote, castFinalVote: doCastFinalVote } = useVoteActions();
  const { can } = usePermissions({ eventId });
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const canManageVoting = can('manage', 'agendaItems');
  const canVote = can('active_voting', 'events');

  // Query event with voting sessions and participants with their roles
  const { event, isLoading: queryLoading } = useEventWithVoting(eventId);

  // Get current voting session derived from the agenda item
  const currentSession = useMemo((): VotingSession | null => {
    if (!agendaItemId || !event?.agenda_items) return null;

    const agendaItem = event.agenda_items.find(
      ai =>
        ai.id === agendaItemId &&
        (ai.voting_phase === 'introduction' || ai.voting_phase === 'voting')
    );

    if (!agendaItem) return null;

    // Flatten final_decisions from all votes on this agenda item
    const allVotes =
      agendaItem.votes?.flatMap(vote =>
        (vote.final_decisions || []).map(d => ({
          id: d.id,
          vote: (vote.choices?.find(c => c.id === d.choice_id)?.label || 'abstain') as VoteValue,
          voter: { id: d.voter_participation_id || '' },
        }))
      ) || [];

    return {
      id: agendaItem.id,
      phase: (agendaItem.voting_phase || 'introduction') as VotingPhase,
      votingType: (agendaItem.type || 'amendment') as VotingType,
      startedAt: agendaItem.start_time ?? undefined,
      endedAt: agendaItem.end_time ?? undefined,
      majorityType: (agendaItem.majority_type || 'simple') as MajorityType,
      targetEntityType: '',
      targetEntityId: agendaItem.amendment_id || '',
      votes: allVotes,
    };
  }, [agendaItemId, event?.agenda_items]);

  // Get eligible voters (participants with active_voting right)
  const eligibleVoters = useMemo((): EligibleVoter[] => {
    if (!event?.participants) return [];
    const votedUserIds = new Set(currentSession?.votes?.map(v => v.voter?.id) || []);
    return computeEligibleVoters(event.participants, votedUserIds);
  }, [event?.participants, currentSession?.votes]);

  const votedCount = eligibleVoters.filter(v => v.hasVoted).length;
  const totalVoters = eligibleVoters.length;

  const hasUserVoted = useMemo(() => {
    if (!user || !currentSession?.votes) return false;
    return currentSession.votes.some(v => v.voter?.id === user.id);
  }, [user, currentSession?.votes]);

  const userVote = useMemo((): VoteValue | null => {
    if (!user || !currentSession?.votes) return null;
    const vote = currentSession.votes.find(v => v.voter?.id === user.id);
    return vote?.vote || null;
  }, [user, currentSession?.votes]);

  const voteResults = useMemo(() => {
    const votes = currentSession?.votes || [];
    return {
      accept: votes.filter(v => v.vote === 'accept').length,
      reject: votes.filter(v => v.vote === 'reject').length,
      abstain: votes.filter(v => v.vote === 'abstain').length,
    };
  }, [currentSession?.votes]);

  // Timer for voting phase
  useEffect(() => {
    if (!currentSession || currentSession.phase !== 'voting' || !currentSession.startedAt) {
      setTimeRemaining(null);
      return;
    }

    if (!currentSession.timeLimit) {
      setTimeRemaining(null);
      return;
    }

    const endTime = currentSession.startedAt + currentSession.timeLimit * 1000;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && currentSession.autoCloseOnTimeout) {
        closeVoting(currentSession.id);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    currentSession?.id,
    currentSession?.phase,
    currentSession?.startedAt,
    currentSession?.timeLimit,
  ]);

  // Auto-close when all voted
  useEffect(() => {
    if (
      currentSession?.phase === 'voting' &&
      currentSession.autoCloseOnAllVoted &&
      votedCount === totalVoters &&
      totalVoters > 0 &&
      canManageVoting
    ) {
      closeVoting(currentSession.id);
    }
  }, [
    currentSession?.phase,
    currentSession?.autoCloseOnAllVoted,
    votedCount,
    totalVoters,
    canManageVoting,
  ]);

  const startIntroductionPhase = useCallback(
    async (params: StartVotingParams): Promise<string> => {
      if (!user || !canManageVoting) {
        toast.error(
          translateText(
            'generated.inline.1233_you_do_not_have_permission_to_manage_voting_42c9604c'
          )
        );
        throw new Error('Permission denied');
      }

      setIsLoading(true);
      try {
        const voteId = crypto.randomUUID();

        await createVote({
          id: voteId,
          agenda_item_id: params.agendaItemId,
          amendment_id: null,
          title: null,
          description: null,
          status: 'open',
          majority_type: params.majorityType || 'simple',
          closing_type: null,
          closing_duration_seconds: null,
          closing_end_time: null,
          visibility: 'public',
          ballot_visibility: 'named',
        });

        await updateAgendaItem({
          id: params.agendaItemId,
          voting_phase: 'introduction',
        });

        toast.success(translateText('generated.inline.1234_introduction_phase_started_f4f4b34e'));
        return voteId;
      } catch (error) {
        console.error('Error starting introduction phase:', error);
        toast.error(translateText('generated.inline.1235_failed_to_start_voting_1ae965cd'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, canManageVoting, eventId]
  );

  const startVotingPhase = useCallback(
    async (sessionId: string, _timeLimit?: number) => {
      void _timeLimit;

      if (!user || !canManageVoting) {
        toast.error(
          translateText(
            'generated.inline.1233_you_do_not_have_permission_to_manage_voting_42c9604c'
          )
        );
        return;
      }

      setIsLoading(true);
      try {
        await updateAgendaItem({
          id: sessionId,
          voting_phase: 'voting',
        });

        toast.success(translateText('generated.inline.1236_voting_has_begun_d509e54a'));
      } catch (error) {
        console.error('Error starting voting phase:', error);
        toast.error(translateText('generated.inline.1235_failed_to_start_voting_1ae965cd'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, canManageVoting, eventId, event?.title, currentSession]
  );

  const closeVoting = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      setIsLoading(true);
      try {
        // Calculate result
        const { accept, reject } = voteResults;
        const majorityType = currentSession?.majorityType || 'simple';
        const result = computeVoteResult(accept, reject, totalVoters, majorityType as MajorityType);

        const session = event?.agenda_items?.find(ai => ai.id === sessionId);
        const agendaItem = session;
        const voteRecord = agendaItem?.votes?.[0];

        if (voteRecord) {
          await updateVote({
            id: voteRecord.id,
            status: 'closed',
          });
        }

        await updateAgendaItem({
          id: sessionId,
          voting_phase: 'completed',
          end_time: Date.now(),
          completed_at: Date.now(),
        });

        toast.success(`Voting completed: ${result}`);
      } catch (error) {
        console.error('Error closing voting:', error);
        toast.error(translateText('generated.inline.1237_failed_to_close_voting_ebe1b4ae'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [
      user,
      eventId,
      event?.title,
      event?.agenda_items,
      currentSession,
      voteResults,
      totalVoters,
      updateAgendaItem,
      updateVote,
    ]
  );

  const castVote = useCallback(
    async (sessionId: string, vote: VoteValue) => {
      if (!user) {
        toast.error(translateText('generated.inline.1238_you_must_be_logged_in_to_vote_7346ffd8'));
        return;
      }

      if (!canVote) {
        toast.error(translateText('generated.inline.1239_you_do_not_have_voting_rights_5b8bfdf4'));
        return;
      }

      if (hasUserVoted) {
        toast.error(translateText('generated.inline.1240_you_have_already_voted_e135d7f4'));
        return;
      }

      if (currentSession?.phase !== 'voting') {
        toast.error(translateText('generated.inline.1241_voting_is_not_currently_active_75aab5db'));
        return;
      }

      setIsLoading(true);
      try {
        // Find the vote record for this agenda item (sessionId = agenda item id)
        const agendaItem = event?.agenda_items?.find(ai => ai.id === sessionId);
        const voteRecord = agendaItem?.votes?.[0];
        if (!voteRecord) {
          toast.error(
            translateText('generated.inline.1242_no_vote_found_for_this_agenda_item_a003a32f')
          );
          return;
        }

        // Find the matching choice for the vote value
        const choice = voteRecord.choices?.find(c => c.label === vote);
        if (!choice) {
          toast.error(translateText('generated.inline.1243_invalid_vote_choice_cb71ec11'));
          return;
        }

        const participationId = crypto.randomUUID();
        const decisionId = crypto.randomUUID();

        await doCastFinalVote(
          {
            id: participationId,
            vote_id: voteRecord.id,
            voter_id: user.id,
          },
          [
            {
              id: decisionId,
              vote_id: voteRecord.id,
              choice_id: choice.id,
              voter_participation_id: isNamedBallot(voteRecord.ballot_visibility)
                ? participationId
                : null,
            },
          ]
        );

        toast.success(translateText('generated.inline.1244_vote_cast_successfully_2d80d997'));
      } catch (error) {
        console.error('Error casting vote:', error);
        toast.error(translateText('generated.inline.1245_failed_to_cast_vote_0b719004'));
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user, canVote, hasUserVoted, currentSession?.phase, event?.agenda_items]
  );

  return {
    currentSession,
    eligibleVoters,
    votedCount,
    totalVoters,
    canVote,
    canManageVoting,
    hasUserVoted,
    userVote,
    voteResults,
    isLoading: isLoading || queryLoading,
    timeRemaining,
    startIntroductionPhase,
    startVotingPhase,
    closeVoting,
    castVote,
  };
}
