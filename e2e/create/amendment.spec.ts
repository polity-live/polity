import { test, expect } from '../fixtures/test';
import { applyOptionalVideoUrl, fillMinimalAmendment, gotoAmendment } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/amendment', () => {
  test('accepts a title video URL @nightly', async ({ createFlowPage, e2eRun }) => {
    await gotoAmendment(createFlowPage);
    await expect(applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix)).resolves.toBe(
      true
    );
  });

  test('creates a targeted amendment @pr @critical', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoAmendment(createFlowPage);
    await fillMinimalAmendment(createFlowPage, e2eRun.prefix);
    await createFlowPage.selectTypeahead('target', seed.groupName, {
      entityType: 'group',
    });
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'amendment',
      prefix: e2eRun.prefix,
    });
  });
});
