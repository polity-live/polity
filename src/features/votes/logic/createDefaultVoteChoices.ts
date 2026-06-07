import type { useVoteActions } from '@/zero/votes/useVoteActions';

const DEFAULT_DECISION_CHOICES = ['accept', 'reject', 'abstain'] as const;

type CreateVoteChoice = (
  args: Parameters<ReturnType<typeof useVoteActions>['createVoteChoice']>[0]
) => Promise<unknown>;

export async function createDefaultDecisionVoteChoices(
  createVoteChoice: CreateVoteChoice,
  voteId: string
) {
  for (const [index, label] of DEFAULT_DECISION_CHOICES.entries()) {
    await createVoteChoice({
      id: crypto.randomUUID(),
      vote_id: voteId,
      label,
      order_index: index + 1,
    });
  }
}
