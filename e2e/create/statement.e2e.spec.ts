import { test } from '../fixtures/test';
import { fillMinimalStatement, gotoStatement } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/statement', () => {
  test('creates a minimal statement @nightly', async ({ createFlowPage, e2eRun }) => {
    await gotoStatement(createFlowPage);
    await fillMinimalStatement(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'statement',
      prefix: e2eRun.prefix,
    });
  });
});
