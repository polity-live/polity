import { beforeEach, describe, expect, it, vi } from 'vitest';

const signUpMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: signUpMock,
    },
  }),
}));

describe('useAuthStore signUpWithPassword', () => {
  beforeEach(() => {
    signUpMock.mockReset();
  });

  it('returns authenticated when signup creates a session immediately', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: { access_token: 'token' },
        user: { id: 'user-1' },
      },
      error: null,
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore.getState().signUpWithPassword('user@example.com', 'secret1');

    expect(result).toEqual({ status: 'authenticated' });
    expect(useAuthStore.getState().error).toBeNull();
  }, 10000);

  it('returns confirmation_required when signup succeeds without a session', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: { id: 'user-2' },
      },
      error: null,
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore.getState().signUpWithPassword('user@example.com', 'secret1');

    expect(result).toEqual({ status: 'confirmation_required' });
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('returns error when Supabase sign up fails', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: new Error('Signup failed upstream'),
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore.getState().signUpWithPassword('user@example.com', 'secret1');

    expect(result).toEqual({
      status: 'error',
      error: 'Signup failed upstream',
    });
    expect(useAuthStore.getState().error).toBe('Signup failed upstream');
  });
});
