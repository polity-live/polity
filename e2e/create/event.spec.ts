import { test, expect } from '../fixtures/test';
import { applyOptionalVideoUrl, fillMinimalEvent, gotoEvent } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/event', () => {
  test('accepts a title video URL @nightly', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoEvent(createFlowPage, seed, 'one_page', {
      eventType: 'open',
      time: 'valid',
    });
    await expect(applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix)).resolves.toBe(
      true
    );
  });

  test('creates a minimal open event @pr @critical', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoEvent(createFlowPage, seed, 'one_page', {
      eventType: 'open',
      time: 'valid',
    });
    await fillMinimalEvent(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'event',
      prefix: e2eRun.prefix,
    });
  });
});
