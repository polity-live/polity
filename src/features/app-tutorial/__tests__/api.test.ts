/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
    },
  }),
}));

import {
  advanceTutorial,
  cleanupTutorial,
  loadTutorialRun,
  pauseTutorial,
  restartTutorial,
  startTutorial,
} from '../api';
import { activateAppTutorialSession, isAppTutorialSessionActive } from '../events';

const run = {
  runId: 'run-1',
  status: 'active' as const,
  currentCheckpointId: 'primary-navigation',
  route: '/home',
  revision: 0,
  expiresAt: '2026-08-25T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('app tutorial API tab lifecycle', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.fetch.mockReset();
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('activates the current tab only after a successful start', async () => {
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ run }));

    await startTutorial();

    expect(isAppTutorialSessionActive()).toBe(true);
  });

  it('restores the active tab session when an existing run loads', async () => {
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ run }));

    await loadTutorialRun();

    expect(isAppTutorialSessionActive()).toBe(true);
  });

  it('deactivates the tab after pause, completion, a missing run, or 401', async () => {
    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ run: { ...run, status: 'paused' } }));
    await pauseTutorial(0);
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ completed: true, route: '/home' }));
    await advanceTutorial(0, 'primary-navigation', { type: 'acknowledge' });
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ run: null }));
    await loadTutorialRun();
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(
      jsonResponse({ error: { version: 1, code: 'permission_denied' } }, 401)
    );
    await expect(loadTutorialRun()).rejects.toMatchObject({
      payload: { version: 1, code: 'permission_denied' },
    });
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await cleanupTutorial(0);
    expect(isAppTutorialSessionActive()).toBe(false);
  });

  it('rejects missing sessions and preserves the tab for non-auth API failures', async () => {
    activateAppTutorialSession();
    mocks.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(loadTutorialRun()).rejects.toBeTruthy();
    expect(isAppTutorialSessionActive()).toBe(false);

    activateAppTutorialSession();
    mocks.fetch.mockResolvedValueOnce(
      jsonResponse({ error: { version: 1, code: 'tutorial_operation_failed' } }, 500)
    );
    await expect(loadTutorialRun()).rejects.toBeTruthy();
    expect(isAppTutorialSessionActive()).toBe(true);
  });

  it('sends restart and keeps an unfinished advance active', async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ run }))
      .mockResolvedValueOnce(jsonResponse({ completed: false, route: '/next', run }));
    await restartTutorial();
    expect(JSON.parse(String((mocks.fetch.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      action: 'restart',
    });
    await advanceTutorial(0, 'primary-navigation', { type: 'acknowledge' });
    expect(isAppTutorialSessionActive()).toBe(true);
  });
});
