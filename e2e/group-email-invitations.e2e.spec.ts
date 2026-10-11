import type { BrowserContext } from '@playwright/test';
import { test, expect } from './fixtures/test';
import { db, e2eBaseUrl, e2eDatabaseUrl } from './fixtures/db';
import { gotoReady, openGroupActorPage } from './fixtures/domains/groups';
import { isLocalTestDatabase } from '../src/test/local-database';
import {
  handleGroupEmailInvitations,
  handlePublicGroupInvitation,
  type InvitationProvider,
  type InvitationConfig,
} from '../src/server/group-email-invitations';

test('admin invites two new accounts and each explicitly accepts its personal link @acceptance', async ({
  page,
  browser,
  seed,
  e2eRun,
}) => {
  if (
    !isLocalTestDatabase(e2eDatabaseUrl()) ||
    !['localhost', '127.0.0.1'].includes(new URL(e2eBaseUrl()).hostname)
  )
    throw new Error('Local invitation acceptance only');
  const actors = [e2eRun.actor('email-first'), e2eRun.actor('email-second')];
  const mails: Parameters<InvitationProvider['send']>[0] = [];
  const provider: InvitationProvider = {
    usage: async () => ({
      emails: { daily: { used: 0, limit: 100 }, monthly: { used: 0, limit: 3000 } },
    }),
    send: async batch => {
      mails.push(...batch);
      return batch.map(() => crypto.randomUUID());
    },
  };
  const config: InvitationConfig = {
    production: false,
    baseUrl: e2eBaseUrl(),
    from: 'Polity <test@example.com>',
    apiKey: 'mail-sink',
    limit: 50,
    allowedRecipients: actors.map(actor => actor.email),
  };
  // Run the actual server services, Auth validation and PostgreSQL transactions;
  // substitute only mail delivery for this isolated test.
  async function bridge(context: BrowserContext) {
    await context.route('**/api/groups/*/email-invitations', async route => {
      const original = route.request();
      const request = new Request(original.url(), {
        method: original.method(),
        headers: original.headers(),
        ...(original.postData() ? { body: original.postData()! } : {}),
      });
      const response = await handleGroupEmailInvitations(request, seed.groupId, {
        config,
        provider,
      });
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
    await context.route('**/api/invitations/*', async route => {
      const original = route.request();
      const request = new Request(original.url(), {
        method: original.method(),
        headers: original.headers(),
        ...(original.postData() ? { body: original.postData()! } : {}),
      });
      const response = await handlePublicGroupInvitation(
        request,
        new URL(original.url()).pathname.split('/').at(-1)!,
        { config }
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
  }
  await bridge(page.context());
  try {
    expect(
      await db()`SELECT id FROM auth.users WHERE email IN (${actors[0].email},${actors[1].email})`
    ).toHaveLength(0);
    await gotoReady(page, `/group/${seed.groupId}/memberships`);
    await page.locator('[data-action-id="groups.invitations.open.members-dialog"]').click();
    await page.getByRole('button', { name: 'By email', exact: true }).click();
    await page
      .locator('#group-invitation-emails')
      .fill(actors.map(actor => actor.email).join('; '));
    const names = [
      ['Ada', 'Lovelace'],
      ['Grace', 'Hopper'],
    ];
    for (const [index, actor] of actors.entries()) {
      const card = page
        .locator('[data-slot="typeahead-selected"]')
        .filter({ hasText: actor.email });
      await card.locator('summary').click();
      await card
        .locator('[data-action-id="groups.email-invitations.firstName"]')
        .fill(names[index][0]);
      await card
        .locator('[data-action-id="groups.email-invitations.lastName"]')
        .fill(names[index][1]);
    }
    const submit = page.locator('[data-action-id="groups.invitations.dialog.submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => mails.length).toBe(2);
    expect(mails.map(mail => mail.to)).toEqual(actors.map(actor => [actor.email]));
    expect(mails[0].html).toMatch(/(Hello|Hallo) Ada Lovelace,/);
    expect(mails[1].html).toMatch(/(Hello|Hallo) Grace Hopper,/);
    const resultBanner = page.getByTestId('email-invitation-send-result');
    await expect(resultBanner).toContainText(/2 successful|2 erfolgreich/);
    await expect(resultBanner).toBeInViewport({ ratio: 1 });
    await expect(submit).toBeDisabled();
    await page.screenshot({ path: '.cache/group-email-invitations/names-success.png' });
    await page.locator('[data-action-id="groups.email-invitations.new-list"]').click();
    await expect(page.locator('#group-invitation-emails')).toHaveValue('');
    await page.locator('[data-action-id="groups.invitations.dialog.cancel"]').click();
    await page.locator('[data-action-id="groups.invitations.open.members-dialog"]').click();
    await expect(page.getByText('Ada Lovelace', { exact: true })).toBeVisible();
    await expect(page.getByText('Grace Hopper', { exact: true })).toBeVisible();
    expect(
      await db()`SELECT first_name,last_name FROM group_invitations.group_email_invitation WHERE group_id=${seed.groupId}::uuid ORDER BY first_name`
    ).toEqual([
      { first_name: 'Ada', last_name: 'Lovelace' },
      { first_name: 'Grace', last_name: 'Hopper' },
    ]);
    const tokens = mails.map(mail => mail.html.match(/\/invite\/([A-Za-z0-9_-]{43})/)![1]);
    expect(new Set(tokens).size).toBe(2);
    for (let index = 0; index < actors.length; index++) {
      const actor = actors[index];
      expect(
        await db()`SELECT id FROM public.group_membership WHERE group_id=${seed.groupId}::uuid AND user_id=${actor.id}::uuid`
      ).toHaveLength(0);
      const actorPage = await openGroupActorPage(browser, actor);
      try {
        await bridge(actorPage.context);
        await actorPage.page.goto(`/invite/${tokens[index]}`);
        const accept = actorPage.page.locator('[data-action-id="groups.email-invitations.accept"]');
        await expect(accept).toBeVisible();
        expect(
          await db()`SELECT id FROM public.group_membership WHERE group_id=${seed.groupId}::uuid AND user_id=${actor.id}::uuid`
        ).toHaveLength(0);
        await accept.click();
        // Poll only the success condition so a failed assertion never prints the bearer URL.
        await expect
          .poll(() => new URL(actorPage.page.url()).pathname === `/group/${seed.groupId}`, {
            timeout: 30_000,
          })
          .toBe(true);
        expect(
          await db()`SELECT status FROM public.group_membership WHERE group_id=${seed.groupId}::uuid AND user_id=${actor.id}::uuid`
        ).toEqual([{ status: 'active' }]);
        expect(
          await db()`SELECT state,accepted_by_id FROM group_invitations.group_email_invitation WHERE group_id=${seed.groupId}::uuid AND email=${actor.email}`
        ).toEqual([{ state: 'accepted', accepted_by_id: actor.id }]);
      } finally {
        await actorPage.close();
      }
    }
  } finally {
    await db()`DELETE FROM group_invitations.group_email_invitation_delivery d USING group_invitations.group_email_invitation i WHERE d.invitation_id=i.id AND i.group_id=${seed.groupId}::uuid`;
  }
});
