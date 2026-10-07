/** Internal decisions use a strict majority of accept/reject votes; a tie fails. */
export function internalVoteResult(counts: {
  votes_for: number;
  votes_against: number;
}): 'passed' | 'rejected' {
  return counts.votes_for > counts.votes_against ? 'passed' : 'rejected';
}
