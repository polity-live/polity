import { test, expect } from '../fixtures/test';
import { cartesianProduct, matrixLimit, scenarioLabel } from '../fixtures/matrix';
import {
  applyOptionalVideoUrl,
  fillMinimalBlogEntry,
  gotoBlogEntry,
  layouts,
  visibilityValues,
} from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

const scenarios = cartesianProduct(
  {
    layout: layouts,
    title: ['empty', 'valid'],
    date: ['default', 'custom'],
    media: ['absent', 'video'],
    group: ['absent', 'present'],
    visibility: visibilityValues,
    hashtags: ['absent', 'present'],
  },
  { max: matrixLimit(48), name: scenarioLabel }
);

test.describe('create/blog-entry', () => {
  test('accepts a title video URL', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoBlogEntry(createFlowPage, seed);
    await expect(applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix)).resolves.toBe(
      true
    );
  });

  test('creates a minimal blog entry @smoke', async ({ createFlowPage, e2eRun, seed }) => {
    await gotoBlogEntry(createFlowPage, seed);
    await fillMinimalBlogEntry(createFlowPage, e2eRun.prefix);
    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'blogEntry',
      prefix: e2eRun.prefix,
    });
  });

  for (const scenario of scenarios) {
    test(`matrix ${scenario.name} @create-full`, async ({ createFlowPage, e2eRun, seed }) => {
      await gotoBlogEntry(
        createFlowPage,
        seed,
        scenario.data.layout as 'one_page' | 'carousel',
        scenario.data.group === 'present'
      );

      if (scenario.data.title === 'valid') {
        await createFlowPage.form.fillText('title', `${e2eRun.prefix} Matrix Blog`, {
          optional: true,
        });
      }
      if (scenario.data.date === 'custom') {
        await createFlowPage.form.fillText('date', '2030-02-01', { optional: true });
      }
      if (scenario.data.media === 'video') {
        await applyOptionalVideoUrl(createFlowPage.page, 'media', e2eRun.prefix);
      }
      await createFlowPage.form.chooseOption('visibility', scenario.data.visibility as string, {
        optional: true,
      });

      if (scenario.data.layout === 'one_page' && scenario.data.title === 'empty') {
        await createFlowPage.form.expectSubmitDisabled();
      } else {
        await expect(createFlowPage.page.locator('[data-create-flow="blog"]')).toBeVisible();
      }
    });
  }
});
