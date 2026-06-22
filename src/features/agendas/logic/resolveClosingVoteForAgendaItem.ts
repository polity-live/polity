import { VOTE_PURPOSE } from '@/zero/votes/vote-workflow';

export interface AgendaClosingVoteCandidate {
  purpose?: string | null;
}

export function resolveClosingVoteForAgendaItem<TVote extends AgendaClosingVoteCandidate>(
  votes: readonly TVote[] | null | undefined
): TVote | null {
  return votes?.find(vote => vote.purpose === VOTE_PURPOSE.closing) ?? null;
}
