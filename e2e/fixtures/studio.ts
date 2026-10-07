import { expect, type Page } from '@playwright/test';
import { waitForAppReady } from './readiness';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function startStudioExportWorker() {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('Studio E2E worker requires the isolated E2E database');
  const worker = spawn(process.execPath, ['--import', 'tsx', 'tools/studio/launch.ts', 'worker'], {
    env: { ...process.env, NODE_ENV: 'production', STUDIO_DATABASE_URL: databaseUrl },
    windowsHide: true,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const closed = new Promise<void>(resolve => worker.once('exit', () => resolve()));
  await once(worker, 'spawn');
  return {
    assertRunning() {
      if (worker.exitCode !== null || worker.signalCode !== null)
        throw new Error('Studio E2E export worker exited unexpectedly');
    },
    async stop() {
      if (worker.exitCode !== null || worker.signalCode !== null) return;
      const timeout = setTimeout(() => worker.kill('SIGKILL'), 10_000);
      try {
        worker.kill('SIGTERM');
        await closed;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export async function createStudioProject(page: Page, title: string): Promise<string> {
  const obsoleteRequests: string[] = [];
  const record = (request: { url(): string }) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/studio' || path.startsWith('/api/studio/read/')) obsoleteRequests.push(path);
  };
  page.on('request', record);
  try {
    await page.goto('/create/studio-project', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await page
      .locator('[data-create-action="set-form-style"][data-create-option="one_page"]')
      .click();
    await page.getByRole('textbox', { name: /^Title(?:\s*\*)?$/ }).fill(title);
    await page.locator('[data-create-action="submit"]').click();
    await expect(page).toHaveURL(/\/studio\/[a-f0-9-]{36}\/?$/, { timeout: 60_000 });
    expect(obsoleteRequests).toEqual([]);
    return new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!;
  } finally {
    page.off('request', record);
  }
}
