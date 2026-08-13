import { expect, test } from './fixtures/test';
import { waitForAppReady } from './fixtures/readiness';

test('reconnects and keeps unsaved navigation state @nightly @mobile @agent1-promotion', async ({
  context,
  page,
  e2eUser,
}) => {
  await page.goto(`/user/${e2eUser.id}/settings?tab=basic-info`);
  await waitForAppReady(page);
  const input = page.locator('#firstName');
  const original = await input.inputValue();
  await input.fill(`${original} offline draft`);

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await expect(page.getByRole('alert')).toHaveAttribute('data-connection-state', 'disconnected');
  await expect(page.getByTestId('app-readiness')).toHaveAttribute(
    'data-zero-connection',
    'disconnected'
  );
  await expect(input).toHaveValue(`${original} offline draft`);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(page.getByRole('status')).toHaveAttribute('data-connection-state', 'reconnecting');
  await expect(page.getByTestId('app-readiness')).toHaveAttribute(
    'data-zero-connection',
    'connected'
  );
  await expect(page.getByTestId('connection-status')).toBeHidden();
  await expect(input).toHaveValue(`${original} offline draft`);
  await page.getByRole('tab', { name: /appearance|darstellung/i }).click();
  await expect(page).toHaveURL(/tab=preferences/);
});
