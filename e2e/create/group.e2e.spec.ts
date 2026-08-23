import { test, expect } from '../fixtures/test';
import { db } from '../fixtures/db';
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

    const groupName = `${e2eRun.prefix} Created Group`;
    const rows = await db()`
      select id
      from public."group"
      where name = ${groupName}
      order by created_at desc
      limit 1
    `;
    const groupId = String(rows[0]?.id ?? '');
    expect(groupId).not.toBe('');
    await createFlowPage.page.goto(`/group/${groupId}`, { waitUntil: 'domcontentloaded' });

    const groupHeading = createFlowPage.page.getByRole('heading', {
      name: groupName,
      exact: true,
    });
    await expect(groupHeading).toBeVisible();
    await expect(createFlowPage.page.locator('[data-entity-visibility="private"]')).toContainText(
      /Private|Privat/
    );
    await createFlowPage.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(groupHeading).toBeVisible({ timeout: 30_000 });
    await expect(
      createFlowPage.page.getByRole('heading', {
        name: /This Page Is Private|Diese Seite ist privat/i,
      })
    ).toHaveCount(0);

    await createFlowPage.page.goto(`/group/${groupId}/settings`, {
      waitUntil: 'domcontentloaded',
    });
    const privateOption = createFlowPage.page.locator('[data-create-option="private"]:visible');
    await expect(privateOption).toHaveAttribute('aria-pressed', 'true');

    const updatedName = `${groupName} Updated`;
    await createFlowPage.page.locator('#name').fill(updatedName);
    await createFlowPage.page.locator('[data-action-id="groups.edit.submit"]').click();
    await expect(createFlowPage.page).toHaveURL(new RegExp(`/group/${groupId}/?$`));
    await expect
      .poll(async () => {
        const persisted = await db()`
          select name, visibility
          from public."group"
          where id = ${groupId}::uuid
        `;
        return persisted[0] ?? null;
      })
      .toMatchObject({ name: updatedName, visibility: 'private' });
    await expect(createFlowPage.page.locator('[data-entity-visibility="private"]')).toContainText(
      /Private|Privat/
    );
  });
});
