import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));

vi.mock('@/lib/supabase/server', () => ({
  getSession: mocks.getSession,
}));

import { Route } from '../tutorial';

interface TutorialHandlers {
  GET: (input: { request: Request }) => Promise<Response>;
  POST: (input: { request: Request }) => Promise<Response>;
}

const handlers = (Route as unknown as { server: { handlers: TutorialHandlers } }).server.handlers;
let configuredDatabaseUrl: string | undefined;

describe('tutorial API configuration isolation', () => {
  beforeEach(() => {
    configuredDatabaseUrl = process.env.ZERO_UPSTREAM_DB;
    delete process.env.ZERO_UPSTREAM_DB;
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
  });

  afterEach(() => {
    if (configuredDatabaseUrl === undefined) {
      delete process.env.ZERO_UPSTREAM_DB;
    } else {
      process.env.ZERO_UPSTREAM_DB = configuredDatabaseUrl;
    }
  });

  it('returns a controlled 503 for GET when the tutorial database is not configured', async () => {
    const response = await handlers.GET({
      request: new Request('http://localhost/api/tutorial'),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        version: 1,
        code: 'tutorial_operation_failed',
      },
    });
  });

  it('returns the same controlled 503 for POST', async () => {
    const response = await handlers.POST({
      request: new Request('http://localhost/api/tutorial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        version: 1,
        code: 'tutorial_operation_failed',
      },
    });
  });

  it('accepts stable entity-selection evidence at the API boundary', async () => {
    const response = await handlers.POST({
      request: new Request('http://localhost/api/tutorial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'advance',
          expectedRevision: 0,
          checkpointId: 'link-climate-council',
          evidence: {
            type: 'entity-selection',
            entityId: 'climate-council-id',
          },
        }),
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        version: 1,
        code: 'tutorial_operation_failed',
      },
    });
  });
});
