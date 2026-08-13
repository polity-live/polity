import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient, getSession } from '../server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.create(...args);
    return { auth: { getUser: mocks.getUser } };
  },
}));

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.SUPABASE_ANON_KEY = 'anon';
  vi.clearAllMocks();
});

describe('Supabase server helpers', () => {
  it('creates the service-role client', () => {
    createClient();
    expect(mocks.create).toHaveBeenCalledWith('https://supabase.test', 'service');
  });

  it('returns null without a bearer token', async () => {
    expect(await getSession(new Request('https://app.test'))).toBeNull();
    expect(
      await getSession(
        new Request('https://app.test', { headers: { authorization: 'Basic credentials' } })
      )
    ).toBeNull();
  });

  it('returns authenticated users and handles missing users', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const request = new Request('https://app.test', {
      headers: { authorization: 'Bearer token' },
    });
    expect(await getSession(request)).toEqual({ user: { id: 'user-1' } });
    expect(mocks.getUser).toHaveBeenCalledWith('token');

    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await getSession(request)).toBeNull();
  });
});
