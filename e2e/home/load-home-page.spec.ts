import { test, expect } from '../fixtures/test-base';

test.describe('Authenticated Home - Load Timeline Page', () => {
  test('renders the timeline page instead of the generated route placeholder', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/home');

    await expect(page.getByRole('heading', { name: /timeline/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Hello "/_authed/home"!')).toHaveCount(0);
  });
});
