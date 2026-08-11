import { test, expect } from '../fixtures/test';
import { applyOptionalVideoUrl, fillMinimalBlogEntry, gotoBlogEntry } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

test.describe('create/blog-entry', () => {
  test('accepts a title video URL @nightly', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoBlogEntry(createFlowPage, seed);
    await expect(applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix)).resolves.toBe(
      true
    );
  });

  test('creates a minimal blog entry @nightly', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoBlogEntry(createFlowPage, seed);
    await fillMinimalBlogEntry(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'blogEntry',
      prefix: e2eRun.prefix,
    });
  });
});
