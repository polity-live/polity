import { test, expect } from '../fixtures/test';
import { applyOptionalVideoUrl, fillMinimalGroup, gotoGroup } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/group', () => {
  test('accepts a title video URL @nightly', async ({ createFlowPage, e2eRun }) => {
    await gotoGroup(createFlowPage);
    await expect(
      applyOptionalVideoUrl(createFlowPage.page, 'image-tags', e2eRun.prefix)
    ).resolves.toBe(true);
  });

  test('creates a minimal group @pr @nightly @critical @mobile @cross-browser @acceptance', async ({
    createFlowPage,
    e2eRun,
  }) => {
    await gotoGroup(createFlowPage);
    await fillMinimalGroup(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'group',
      prefix: e2eRun.prefix,
    });
  });
});
