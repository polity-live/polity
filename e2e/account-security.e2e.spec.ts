import type { BrowserContext } from '@playwright/test';

import { expect, test } from './fixtures/test';
import { signInThroughUi } from './fixtures/auth-flow-page';
import { e2eBaseUrl } from './fixtures/db';

const inbucketUrl = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324';

async function latestSecurityCode(email: string) {
  const mailpitResponse = await fetch(
    `${inbucketUrl}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
  );
  if (mailpitResponse.ok) {
    const result = (await mailpitResponse.json()) as {
      messages?: { Snippet?: string; Subject?: string; To?: { Address?: string }[] }[];
    };
    const message = result.messages?.find(item =>
      item.To?.some(recipient => recipient.Address === email)
    );
    const code = `${message?.Subject ?? ''} ${message?.Snippet ?? ''}`.match(/\b\d{6}\b/)?.[0];
    if (code) return code;
  }

  const mailbox = email.split('@')[0];
  const listResponse = await fetch(`${inbucketUrl}/api/v1/mailbox/${mailbox}`);
  if (!listResponse.ok) return null;
  const messages = (await listResponse.json()) as { id?: string }[];
  const id = messages.at(0)?.id;
  if (!id) return null;
  const messageResponse = await fetch(`${inbucketUrl}/api/v1/mailbox/${mailbox}/${id}`);
  if (!messageResponse.ok) return null;
  const message = (await messageResponse.json()) as { body?: { text?: string }; text?: string };
  return (message.body?.text ?? message.text ?? '').match(/\b\d{6}\b/)?.[0] ?? null;
}

async function setLocalActorPassword(userId: string, password: string) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Local Supabase admin credentials are required.');
  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error(`Password restoration failed with HTTP ${response.status}.`);
}

async function mockCurrencyApi(context: BrowserContext) {
  await context.route('**/api/currency/currencies', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ currencies: ['EUR', 'GBP', 'JPY', 'USD'], source: 'test' }),
    })
  );
  await context.route('**/api/currency/rates', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rates: [] }),
    })
  );
}

test('globally revokes sessions when the password changes @nightly @agent1-promotion', async ({
  browser,
  page,
  e2eUser,
}) => {
  const newPassword = `${e2eUser.password}-changed`;
  let secondaryContext: BrowserContext | undefined;

  try {
    secondaryContext = await browser.newContext({ baseURL: e2eBaseUrl() });
    await secondaryContext.addInitScript(() => {
      window.sessionStorage.setItem('polity.alphaWarning.0.11.1.acknowledged', 'true');
    });
    await mockCurrencyApi(secondaryContext);
    const secondaryPage = await secondaryContext.newPage();
    await secondaryPage.goto('/auth/sign-in');
    await signInThroughUi(secondaryPage, e2eUser);

    await page.goto(`/user/${e2eUser.id}/settings?tab=passwords`);
    await page.locator('#account-password').fill(newPassword);
    await page.locator('#account-password-confirm').fill(newPassword);
    await page
      .locator('form[data-action-id="users.account.password.submit"]')
      .getByRole('button', { name: /update account password/i })
      .click();
    await page.locator('#current-account-password').fill(e2eUser.password);
    await page
      .locator('form[data-action-id="users.security-confirmation.submit"]')
      .getByRole('button', { name: /confirm/i })
      .click();

    let code: string | null = null;
    await expect
      .poll(
        async () => {
          code = await latestSecurityCode(e2eUser.email);
          return code;
        },
        { timeout: 30_000 }
      )
      .not.toBeNull();
    if (!code) throw new Error('Security verification code was not delivered.');
    await page.locator('#account-verification-code').fill(code);
    await page
      .locator('form[data-action-id="users.security-confirmation.submit"]')
      .getByRole('button', { name: /confirm/i })
      .click();

    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await secondaryPage.reload();
    await expect(secondaryPage).toHaveURL(/\/auth\/sign-in/);

    const signInForm = page.locator('form[data-action-id="auth.sign-in.submit.password"]');
    await signInForm.locator('#email').fill(e2eUser.email);
    await signInForm.locator('#password').fill(e2eUser.password);
    await signInForm.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    await signInThroughUi(
      page,
      { ...e2eUser, password: newPassword },
      new RegExp(`/user/${e2eUser.id}/settings$`)
    );
    await expect(page.getByRole('tab', { name: 'Account & Passwords' })).toBeVisible();
  } finally {
    await secondaryContext?.close().catch(() => undefined);
    await setLocalActorPassword(e2eUser.id, e2eUser.password);
  }
});
