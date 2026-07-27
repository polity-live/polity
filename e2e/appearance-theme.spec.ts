import { expect, test } from './fixtures/test';

test.describe('appearance themes', () => {
  test('applies and persists a builtin theme without reloading the app', async ({
    page,
    e2eUser,
  }) => {
    const polityTheme = () => page.getByRole('button', { name: /^Polity\b/i });
    const spdTheme = () => page.getByRole('button', { name: /^SPD\b/i });

    await page.goto(`/user/${e2eUser.id}/settings?tab=preferences`);
    await expect(spdTheme()).toBeVisible();

    try {
      await spdTheme().click();
      await expect(spdTheme()).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
              background: style.getPropertyValue('--background').trim(),
              card: style.getPropertyValue('--card').trim(),
              primary: style.getPropertyValue('--primary').trim(),
              fontSans: style.getPropertyValue('--font-sans-family').trim(),
            };
          })
        )
        .toEqual({
          background: '#FFF5F5',
          card: '#FFFFFF',
          primary: '#B8183B',
          fontSans: "'Open Sans', ui-sans-serif, system-ui, sans-serif",
        });

      await page.reload();
      await expect(spdTheme()).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
              background: style.getPropertyValue('--background').trim(),
              card: style.getPropertyValue('--card').trim(),
              primary: style.getPropertyValue('--primary').trim(),
              fontSans: style.getPropertyValue('--font-sans-family').trim(),
            };
          })
        )
        .toEqual({
          background: '#FFF5F5',
          card: '#FFFFFF',
          primary: '#B8183B',
          fontSans: "'Open Sans', ui-sans-serif, system-ui, sans-serif",
        });
    } finally {
      await polityTheme().click();
      await expect(polityTheme()).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(polityTheme()).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
