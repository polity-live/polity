import { test, expect } from '../fixtures/test';
import { applyOptionalVideoUrl, fillMinimalGroup, gotoGroup, layouts } from './helpers';
import { submitSmokeAndExpectCreated } from './smoke-expectations';

async function advanceCarousel(createFlowPage: Parameters<typeof gotoGroup>[0], count: number) {
  const next = createFlowPage.page.locator('[data-create-action="next-step"]:visible');
  for (let index = 0; index < count; index += 1) {
    await next.click();
  }
}

test.describe('create/group', () => {
  for (const layout of layouts) {
    test(`updates the visible ${layout} review when visibility changes @pr @nightly`, async ({
      createFlowPage,
      e2eRun,
    }) => {
      await gotoGroup(createFlowPage, layout);
      await fillMinimalGroup(createFlowPage, `${e2eRun.prefix} Review`);

      if (layout === 'carousel') {
        await advanceCarousel(createFlowPage, 3);
      } else {
        const publicLabel = (
          await createFlowPage.form
            .field('image-tags')
            .locator('[data-create-option="public"]:visible')
            .innerText()
        ).trim();
        await expect(createFlowPage.form.field('review')).toContainText(publicLabel);
      }

      const authenticatedOption = createFlowPage.form
        .field('image-tags')
        .locator('[data-create-option="authenticated"]:visible');
      const authenticatedLabel = (await authenticatedOption.innerText()).trim();
      await createFlowPage.form.chooseOption('image-tags', 'authenticated');

      if (layout === 'carousel') {
        await advanceCarousel(createFlowPage, 3);
      }

      const review = createFlowPage.form.field('review');
      await expect(review).toBeVisible();
      await expect(review).toContainText(authenticatedLabel);

      if (layout === 'one_page') {
        const privateOption = createFlowPage.form
          .field('image-tags')
          .locator('[data-create-option="private"]:visible');
        const privateLabel = (await privateOption.innerText()).trim();
        await createFlowPage.form.chooseOption('image-tags', 'private');
        await expect(review).toContainText(privateLabel);
      }
    });
  }

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

  test('creates and reopens a private group as its owner @pr @nightly @critical', async ({
    createFlowPage,
    e2eRun,
  }) => {
    await gotoGroup(createFlowPage);
    await fillMinimalGroup(createFlowPage, e2eRun.prefix);
    await createFlowPage.form.chooseOption('image-tags', 'private');

    await submitSmokeAndExpectCreated(createFlowPage, {
      kind: 'group',
      prefix: e2eRun.prefix,
    });

    const groupHeading = createFlowPage.page.getByRole('heading', {
      name: `${e2eRun.prefix} Created Group`,
      exact: true,
    });
    await expect(groupHeading).toBeVisible();
    await createFlowPage.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(groupHeading).toBeVisible({ timeout: 30_000 });
    await expect(
      createFlowPage.page.getByRole('heading', {
        name: /This Page Is Private|Diese Seite ist privat/i,
      })
    ).toHaveCount(0);
  });
});
