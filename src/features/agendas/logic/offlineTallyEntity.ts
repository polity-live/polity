import type { OfflineTallyPhase } from './offlineTallyToolbar';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CandidateLike {
  id: string;
  status?: string | null;
  name?: string | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}

interface ElectionOfflineTallyLike {
  phase?: string | null;
  candidate_id?: string | null;
  count?: number | null;
}

interface ElectionLike {
  id: string;
  title?: string | null;
  candidates?: readonly CandidateLike[] | null;
  offline_tallies?: readonly ElectionOfflineTallyLike[] | null;
  max_votes?: number | null;
}

interface VoteChoiceLike {
  id: string;
  label?: string | null;
}

interface VoteOfflineTallyLike {
  phase?: string | null;
  choice_id?: string | null;
  count?: number | null;
}

interface VoteLike {
  id: string;
  title?: string | null;
  choices?: readonly VoteChoiceLike[] | null;
  offline_tallies?: readonly VoteOfflineTallyLike[] | null;
}

export type OfflineTallyEntity =
  | {
      kind: 'election';
      itemId: string;
      title: string;
      choices: { id: string; label: string }[];
      tallies: { id: string; count: number }[];
      participantCount: number;
      votesPerParticipant: number;
      maxPerEntryVotes: number;
      maxTotalVotes: number;
    }
  | {
      kind: 'vote';
      itemId: string;
      title: string;
      choices: { id: string; label: string }[];
      tallies: { id: string; count: number }[];
      participantCount: number;
      votesPerParticipant: 1;
      maxPerEntryVotes: null;
      maxTotalVotes: number;
    };

function getCandidateLabel(candidate: CandidateLike) {
  if (!candidate.user) {
    return candidate.name || translateText('features.events.agenda.candidate');
  }

  return (
    `${candidate.user.first_name ?? ''} ${candidate.user.last_name ?? ''}`.trim() ||
    candidate.user.email ||
    candidate.name ||
    translateText('features.events.agenda.candidate')
  );
}

export function buildOfflineTallyEntity({
  phase,
  agendaTitle,
  election,
  electionCandidates,
  vote,
  voteChoices,
  participantCount,
}: {
  phase: OfflineTallyPhase | null;
  agendaTitle?: string | null;
  election?: ElectionLike | null;
  electionCandidates?: readonly CandidateLike[] | null;
  vote?: VoteLike | null;
  voteChoices?: readonly VoteChoiceLike[] | null;
  participantCount: number;
}): OfflineTallyEntity | null {
  if (!phase) {
    return null;
  }

  if (election) {
    const maxVotes = Math.max(1, election.max_votes ?? 1);

    return {
      kind: 'election',
      itemId: election.id,
      title: election.title ?? agendaTitle ?? translateText('features.events.agenda.thisElection'),
      choices: (electionCandidates ?? election.candidates ?? [])
        .filter(candidate => candidate.status !== 'withdrawn')
        .map(candidate => ({
          id: candidate.id,
          label: getCandidateLabel(candidate),
        })),
      tallies: (election.offline_tallies ?? [])
        .filter(tally => tally.phase === phase && tally.candidate_id)
        .map(tally => ({
          id: tally.candidate_id ?? '',
          count: tally.count ?? 0,
        })),
      participantCount,
      votesPerParticipant: maxVotes,
      maxPerEntryVotes: participantCount,
      maxTotalVotes: participantCount * maxVotes,
    };
  }

  if (vote) {
    return {
      kind: 'vote',
      itemId: vote.id,
      title: vote.title ?? agendaTitle ?? translateText('features.events.agenda.thisVote'),
      choices: (voteChoices ?? vote.choices ?? []).map((choice, index) => ({
        id: choice.id,
        label:
          choice.label ||
          translateText('features.events.agenda.defaultChoiceLabels.choiceWithNumber', {
            count: index + 1,
          }),
      })),
      tallies: (vote.offline_tallies ?? [])
        .filter(tally => tally.phase === phase && tally.choice_id)
        .map(tally => ({
          id: tally.choice_id ?? '',
          count: tally.count ?? 0,
        })),
      participantCount,
      votesPerParticipant: 1,
      maxPerEntryVotes: null,
      maxTotalVotes: participantCount,
    };
  }

  return null;
}
