import { expect, test } from './fixtures/test';
import { signOutThroughUserMenu } from './fixtures/auth-flow-page';

const inbucketUrl = process.env.INBUCKET_URL ?? 'http://127.0.0.1:54324';

async function latestSecurityCode(email: string) {
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

test('changes the password, rejects old credentials and accepts a new login @nightly', async ({
  page,
  e2eUser,
}) => {
  const newPassword = `${e2eUser.password}-changed`;
  try {
    await page.goto(`/user/${e2eUser.id}/settings?tab=passwords`);
    await page.locator('#account-password').fill(newPassword);
    await page.locator('#account-password-confirm').fill(newPassword);
    await page
      .locator('form[data-action-id="users.account.password.submit"]')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());
    await page.locator('#current-account-password').fill(e2eUser.password);
    await page
      .locator('form[data-action-id="users.security-confirmation.submit"]')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());

    let code: string | null = null;
    await expect
      .poll(async () => {
        code = await latestSecurityCode(e2eUser.email);
        return code;
      })
      .not.toBeNull();
    if (!code) throw new Error('Security verification code was not delivered.');
    await page.locator('#account-verification-code').fill(code);
    await page
      .locator('form[data-action-id="users.security-confirmation.submit"]')
      .evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect(page.locator('#account-verification-code')).toBeHidden();

    await signOutThroughUserMenu(page);
    await page.locator('#email').fill(e2eUser.email);
    await page.locator('#password').fill(e2eUser.password);
    await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect(page).toHaveURL(/\/auth\/sign-in/);

    await page.locator('#password').fill(newPassword);
    await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit());
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 90_000 }).toBe('/home');
  } finally {
    await setLocalActorPassword(e2eUser.id, e2eUser.password);
  }
});
