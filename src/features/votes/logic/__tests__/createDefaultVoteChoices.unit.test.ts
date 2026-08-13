import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultDecisionVoteChoices } from '../createDefaultVoteChoices';

const mocks = vi.hoisted(() => ({
  waitForClientApply: vi.fn(async (_result: unknown) => undefined),
}));

vi.mock('@/zero/mutate-with-server-check', () => ({
  waitForClientApply: (result: unknown) => mocks.waitForClientApply(result),
}));

describe('createDefaultDecisionVoteChoices', () => {
  beforeEach(() => {
    mocks.waitForClientApply.mockClear();
  });

  it('creates the ordered decision choices and waits after every mutation', async () => {
    const uuids = ['choice-accept', 'choice-reject', 'choice-abstain'];
    const randomUuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockImplementation(
        () => uuids.shift() as `${string}-${string}-${string}-${string}-${string}`
      );
    const inputs: unknown[] = [];
    const mutationResults: unknown[] = [];
    const createVoteChoice: Parameters<typeof createDefaultDecisionVoteChoices>[0] = input => {
      inputs.push(input);
      const result = {
        client: Promise.resolve({ type: 'success' as const }),
        server: Promise.resolve({ type: 'success' as const }),
      };
      mutationResults.push(result);
      return result;
    };

    await createDefaultDecisionVoteChoices(createVoteChoice, 'vote-42');

    expect(inputs).toEqual([
      { id: 'choice-accept', vote_id: 'vote-42', label: 'accept', order_index: 1 },
      { id: 'choice-reject', vote_id: 'vote-42', label: 'reject', order_index: 2 },
      { id: 'choice-abstain', vote_id: 'vote-42', label: 'abstain', order_index: 3 },
    ]);
    expect(mocks.waitForClientApply.mock.calls).toEqual(mutationResults.map(value => [value]));

    randomUuid.mockRestore();
  });
});
