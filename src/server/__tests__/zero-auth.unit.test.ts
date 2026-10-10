import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: supabase.createClient }));
vi.mock('@/lib/env', () => ({
  getRequiredEnvVar: (_value: unknown, name: string) =>
    name === 'SUPABASE_URL' ? 'https://supabase.test' : 'anon-key',
}));

import { getAuthFromRequest, getValidatedRequestUser } from '../zero-auth';

beforeEach(() => {
  vi.clearAllMocks();
  supabase.createClient.mockReturnValue({ auth: { getUser: supabase.getUser } });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('Zero request authentication', () => {
  it('returns anon without an exact bearer authorization header', async () => {
    await expect(getAuthFromRequest(new Request('https://zero.test'))).resolves.toEqual({
      userID: 'anon',
      email: '',
    });
    await expect(
      getAuthFromRequest(
        new Request('https://zero.test', { headers: { authorization: 'Basic credentials' } })
      )
    ).resolves.toEqual({ userID: 'anon', email: '' });
    expect(supabase.createClient).not.toHaveBeenCalled();
  });

  it('validates the token and maps authenticated identity with and without email', async () => {
    supabase.getUser
      .mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'ada@example.test' } },
        error: null,
      })
      .mockResolvedValueOnce({ data: { user: { id: 'user-2' } }, error: null });

    await expect(
      getAuthFromRequest(
        new Request('https://zero.test', { headers: { authorization: 'Bearer token-1' } })
      )
    ).resolves.toEqual({ userID: 'user-1', email: 'ada@example.test' });
    await expect(
      getAuthFromRequest(
        new Request('https://zero.test', { headers: { authorization: 'Bearer token-2' } })
      )
    ).resolves.toEqual({ userID: 'user-2', email: '' });
    expect(supabase.createClient).toHaveBeenCalledWith('https://supabase.test', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    expect(supabase.getUser).toHaveBeenNthCalledWith(1, 'token-1');
    expect(supabase.getUser).toHaveBeenNthCalledWith(2, 'token-2');
  });

  it('falls back to anon for provider errors and missing users without leaking failures', async () => {
    supabase.getUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'Expired' } })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = () =>
      new Request('https://zero.test', { headers: { authorization: 'Bearer invalid' } });

    await expect(getAuthFromRequest(request())).resolves.toEqual({ userID: 'anon', email: '' });
    await expect(getAuthFromRequest(request())).resolves.toEqual({ userID: 'anon', email: '' });
    expect(console.warn).toHaveBeenCalledWith('[zero-auth] Token validation failed:', 'Expired');
    expect(console.warn).toHaveBeenCalledWith(
      '[zero-auth] Token validation failed:',
      'no user returned'
    );
  });

  it('shares concurrent validation but checks the same token again after completion', async () => {
    let resolve!: (value: unknown) => void;
    supabase.getUser.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const request = () =>
      new Request('https://zero.test', {
        headers: { authorization: 'Bearer concurrent' },
      });
    const first = getAuthFromRequest(request());
    const second = getAuthFromRequest(request());
    const serverFunction = getValidatedRequestUser(request());
    expect(supabase.getUser).toHaveBeenCalledTimes(1);
    resolve({ data: { user: { id: 'owner' } }, error: null });
    expect(await first).toEqual({ userID: 'owner', email: '' });
    expect(await second).toEqual({ userID: 'owner', email: '' });
    expect(await serverFunction).toEqual({ id: 'owner' });
    supabase.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Revoked' } });
    await expect(getAuthFromRequest(request())).resolves.toEqual({ userID: 'anon', email: '' });
    expect(supabase.getUser).toHaveBeenCalledTimes(2);
  });

  it('removes rejected in-flight requests so that a later validation can recover', async () => {
    const request = () =>
      new Request('https://zero.test', {
        headers: { authorization: 'Bearer retry' },
      });
    supabase.getUser.mockRejectedValueOnce(new Error('unavailable'));
    await expect(getAuthFromRequest(request())).rejects.toThrow('unavailable');
    supabase.getUser.mockResolvedValueOnce({ data: { user: { id: 'recovered' } }, error: null });
    await expect(getAuthFromRequest(request())).resolves.toEqual({
      userID: 'recovered',
      email: '',
    });
    expect(supabase.getUser).toHaveBeenCalledTimes(2);
  });
});
