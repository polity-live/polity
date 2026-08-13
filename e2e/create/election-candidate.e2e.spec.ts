import { test } from '../fixtures/test';
import { fillMinimalElectionCandidate, gotoElectionCandidate } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/election-candidate', () => {
  test('creates a minimal election candidate @nightly', async ({
    createFlowPage,
    e2eRun,
    seed,
  }) => {
    await gotoElectionCandidate(createFlowPage);
    await fillMinimalElectionCandidate(createFlowPage, seed, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'electionCandidate',
      prefix: e2eRun.prefix,
      seed,
    });
  });
});
