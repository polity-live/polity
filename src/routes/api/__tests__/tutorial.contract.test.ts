import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class DatabaseUnavailableError extends Error {}
  class EffectPendingError extends Error {}
  return {
    DatabaseUnavailableError,
    EffectPendingError,
    advance: vi.fn(),
    cleanup: vi.fn(),
    getRun: vi.fn(),
    getSession: vi.fn(),
    isCheckpoint: vi.fn(),
    pause: vi.fn(),
    start: vi.fn(),
  };
});

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));
vi.mock('@/lib/supabase/server', () => ({ getSession: mocks.getSession }));
vi.mock('@/server/app-tutorial/db', () => ({
  AppTutorialDatabaseUnavailableError: mocks.DatabaseUnavailableError,
}));
vi.mock('@/server/app-tutorial/service', () => ({
  AppTutorialEffectPendingError: mocks.EffectPendingError,
  advanceAppTutorial: mocks.advance,
  cleanupAppTutorial: mocks.cleanup,
  getAppTutorialRun: mocks.getRun,
  isAppTutorialCheckpointId: mocks.isCheckpoint,
  pauseAppTutorial: mocks.pause,
  startOrResumeAppTutorial: mocks.start,
}));

import { Route } from '../tutorial';

interface TutorialHandlers {
  GET: (input: { request: Request }) => Promise<Response>;
  POST: (input: { request: Request }) => Promise<Response>;
}

const handlers = (Route as unknown as { server: { handlers: TutorialHandlers } }).server.handlers;

function request(body?: unknown) {
  return new Request('http://localhost/api/tutorial', {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.getRun.mockResolvedValue({ id: 'run-1', route: '/tutorial/next' });
  mocks.isCheckpoint.mockReturnValue(true);
  mocks.start.mockResolvedValue({ id: 'run-start' });
  mocks.pause.mockResolvedValue({ id: 'run-paused' });
  mocks.cleanup.mockResolvedValue(undefined);
  mocks.advance.mockResolvedValue({ completed: false });
});

describe('tutorial API contract', () => {
  it.each(['GET', 'POST'] as const)('rejects anonymous %s requests', async method => {
    mocks.getSession.mockResolvedValue(method === 'GET' ? null : {});
    const response = await handlers[method]({
      request: method === 'GET' ? request() : request({ action: 'start' }),
    });
    expect(response.status).toBe(401);
  });

  it('loads the authenticated tutorial run', async () => {
    const response = await handlers.GET({ request: request() });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      run: { id: 'run-1', route: '/tutorial/next' },
    });
    expect(mocks.getRun).toHaveBeenCalledWith('user-1');
  });

  it.each([
    ['start', false],
    ['restart', true],
  ] as const)('handles %s', async (action, restart) => {
    const response = await handlers.POST({ request: request({ action }) });
    expect(response.status).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith('user-1', restart);
  });

  it('pauses, cleans up and advances a run', async () => {
    let response = await handlers.POST({
      request: request({ action: 'pause', expectedRevision: 3 }),
    });
    expect(response.status).toBe(200);
    expect(mocks.pause).toHaveBeenCalledWith('user-1', 3);

    response = await handlers.POST({
      request: request({ action: 'cleanup', expectedRevision: 4 }),
    });
    expect(response.status).toBe(200);
    expect(mocks.cleanup).toHaveBeenCalledWith('user-1', 4);
    await expect(response.json()).resolves.toEqual({ ok: true });

    response = await handlers.POST({
      request: request({ action: 'cleanup' }),
    });
    expect(response.status).toBe(200);
    expect(mocks.cleanup).toHaveBeenLastCalledWith('user-1', undefined);

    const evidence = { type: 'click', anchor: 'next' };
    response = await handlers.POST({
      request: request({
        action: 'advance',
        expectedRevision: 5,
        checkpointId: 'checkpoint-1',
        evidence,
      }),
    });
    expect(response.status).toBe(200);
    expect(mocks.advance).toHaveBeenCalledWith('user-1', 5, 'checkpoint-1', evidence);
  });

  it('rejects an unknown checkpoint and malformed input', async () => {
    mocks.isCheckpoint.mockReturnValue(false);
    let response = await handlers.POST({
      request: request({
        action: 'advance',
        expectedRevision: 0,
        checkpointId: 'unknown',
        evidence: {},
      }),
    });
    expect(response.status).toBe(400);
    expect(mocks.advance).not.toHaveBeenCalled();

    response = await handlers.POST({ request: request({ action: 'pause' }) });
    expect(response.status).toBe(400);
  });

  it.each([
    { failure: new mocks.DatabaseUnavailableError('offline'), status: 503 },
    { failure: new Error('revision conflict'), status: 409 },
    { failure: new Error('run paused'), status: 409 },
    { failure: new Error('evidence required'), status: 422 },
    { failure: new Error('Expected revision'), status: 422 },
    { failure: new Error('run not found'), status: 422 },
    { failure: new Error('unexpected'), status: 500 },
    { failure: 'primitive failure', status: 500 },
  ])('maps a service failure to status $status', async ({ failure, status }) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getRun.mockRejectedValue(failure);
    const response = await handlers.GET({ request: request() });
    expect(response.status).toBe(status);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns pending progress with a current run or the onboarding fallback', async () => {
    mocks.advance.mockRejectedValue(new mocks.EffectPendingError('pending'));
    let response = await handlers.POST({
      request: request({
        action: 'advance',
        expectedRevision: 1,
        checkpointId: 'checkpoint-1',
        evidence: {},
      }),
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      pending: true,
      route: '/tutorial/next',
      run: { id: 'run-1' },
    });

    mocks.getRun.mockResolvedValue(null);
    response = await handlers.POST({
      request: request({
        action: 'advance',
        expectedRevision: 1,
        checkpointId: 'checkpoint-1',
        evidence: {},
      }),
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      completed: false,
      pending: true,
      route: '/onboarding',
    });
  });

  it('treats a pending error before authentication as a regular failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getSession.mockRejectedValue(new mocks.EffectPendingError('too early'));
    const response = await handlers.POST({ request: request({ action: 'start' }) });
    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });
});
