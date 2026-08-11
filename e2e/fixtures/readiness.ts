import { expect, type Page } from '@playwright/test';

const DEFAULT_APP_READY_TIMEOUT_MS = 90_000;

export async function waitForAppReady(page: Page, timeout = DEFAULT_APP_READY_TIMEOUT_MS) {
  const marker = page.getByTestId('app-readiness');
  await expect(marker).toHaveAttribute('data-app-state', 'ready', { timeout });
  await expect(marker).toHaveAttribute('data-auth-state', 'authenticated', {
    timeout,
  });
  await expect(marker).toHaveAttribute('data-data-state', 'hydrated', {
    timeout,
  });
  await expect(marker).toHaveAttribute('data-zero-connection', 'connected', {
    timeout,
  });
}
