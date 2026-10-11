export function getWinningCandidateIds(args: {
  candidateStats: {
    candidate: { id: string; order_index?: number | null };
    finalCount: number;
  }[];
  electionMode?: 'single' | 'list' | null;
  seatCount?: number | null;
}): string[] {
  const positiveVoteCandidates = [...args.candidateStats]
    .filter(candidate => candidate.finalCount > 0)
    .sort((left, right) => {
      const voteDelta = right.finalCount - left.finalCount;
      if (voteDelta !== 0) {
        return voteDelta;
      }

      const orderDelta =
        (left.candidate.order_index ?? Number.MAX_SAFE_INTEGER) -
        (right.candidate.order_index ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return left.candidate.id.localeCompare(right.candidate.id);
    });

  if (positiveVoteCandidates.length === 0) {
    return [];
  }

  if (args.electionMode !== 'list') {
    // The empty case returned above, so index zero is present by construction.
    const winner = positiveVoteCandidates[0] as (typeof positiveVoteCandidates)[number];
    const runnerUp = positiveVoteCandidates[1];

    if (runnerUp && winner.finalCount === runnerUp.finalCount) {
      return [];
    }

    return [winner.candidate.id];
  }

  const resolvedSeatCount = Math.max(1, args.seatCount ?? 1);
  const winners = positiveVoteCandidates.slice(0, resolvedSeatCount);
  const boundaryWinner = winners[winners.length - 1];
  const nextCandidate = positiveVoteCandidates[winners.length];

  if (
    boundaryWinner &&
    nextCandidate &&
    boundaryWinner.finalCount > 0 &&
    boundaryWinner.finalCount === nextCandidate.finalCount
  ) {
    return [];
  }

  return winners.map(candidate => candidate.candidate.id);
}
