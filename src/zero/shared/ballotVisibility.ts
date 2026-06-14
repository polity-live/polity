import { z } from 'zod';

export const ballotVisibilityValues = ['named', 'secret'] as const;

export type BallotVisibility = (typeof ballotVisibilityValues)[number];

export const ballotVisibilitySchema = z.enum(ballotVisibilityValues);

export const defaultVoteBallotVisibility: BallotVisibility = 'named';
export const defaultElectionBallotVisibility: BallotVisibility = 'secret';

export function isNamedBallot(
  ballotVisibility: string | null | undefined
): ballotVisibility is 'named' {
  return ballotVisibility === 'named';
}

export function resolveVoteBallotVisibility(
  ballotVisibility: string | null | undefined
): BallotVisibility {
  return isNamedBallot(ballotVisibility) ? 'named' : defaultVoteBallotVisibility;
}

export function resolveElectionBallotVisibility(
  ballotVisibility: string | null | undefined
): BallotVisibility {
  return ballotVisibility === 'secret' ? 'secret' : defaultElectionBallotVisibility;
}
