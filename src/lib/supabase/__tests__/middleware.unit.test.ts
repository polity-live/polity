import { beforeEach, describe, expect, it, vi } from 'vitest';

import { verifySession } from '../middleware';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'https://supabase.example.test';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('verifySession', () => {
  it('rejects missing and non-bearer authorization without contacting auth', async () => {
    await expect(verifySession(new Request('https://app.test'))).resolves.toBeNull();
    await expect(
      verifySession(
        new Request('https://app.test', { headers: { authorization: 'Basic credentials' } })
      )
    ).resolves.toBeNull();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('constructs the environment-scoped client and verifies the exact bearer token', async () => {
    await expect(
      verifySession(
        new Request('https://app.test', { headers: { authorization: 'Bearer token-1' } })
      )
    ).resolves.toEqual({ id: 'user-1' });
    expect(mocks.createClient).toHaveBeenCalledWith('https://supabase.example.test', 'anon-key');
    expect(mocks.getUser).toHaveBeenCalledWith('token-1');
  });
});
