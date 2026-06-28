import type { useVoteActions } from '@/zero/votes/useVoteActions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

const DEFAULT_DECISION_CHOICES = ['accept', 'reject', 'abstain'] as const;

type CreateVoteChoice = (
  args: Parameters<ReturnType<typeof useVoteActions>['createVoteChoice']>[0]
) => ReturnType<ReturnType<typeof useVoteActions>['createVoteChoice']>;

export async function createDefaultDecisionVoteChoices(
  createVoteChoice: CreateVoteChoice,
  voteId: string
) {
  for (const [index, label] of DEFAULT_DECISION_CHOICES.entries()) {
    await waitForClientApply(
      createVoteChoice({
        id: crypto.randomUUID(),
        vote_id: voteId,
        label,
        order_index: index + 1,
      })
    );
  }
}
