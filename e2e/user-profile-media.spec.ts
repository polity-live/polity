import { test, expect } from './fixtures/test';

test.describe('user profile media', () => {
  test('accepts a title video URL in user settings', async ({ page, e2eUser }) => {
    await page.goto(`/user/${e2eUser.id}/settings?tab=basic-info`);
    await page.getByRole('tab', { name: /video/i }).click();

    const videoUrl = page.getByTestId('video-upload-url-input');
    await expect(videoUrl).toBeVisible();
    await videoUrl.fill('https://example.test/profile-video.mp4');
    await expect(videoUrl).toHaveValue('https://example.test/profile-video.mp4');
  });
});
