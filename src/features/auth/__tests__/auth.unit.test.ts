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
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: {
            language: 'en',
          },
          emailRedirectTo: expect.stringMatching(/\/auth\/callback$/),
        }),
      })
    );
  }, 10000);

  it('returns confirmation_required when signup succeeds without a session', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: {
          id: 'user-2',
          identities: [{ identity_id: 'identity-2', provider: 'email' }],
        },
      },
      error: null,
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore.getState().signUpWithPassword('user@example.com', 'secret1');

    expect(result).toEqual({ status: 'confirmation_required' });
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('returns a localized error when signup returns an obfuscated existing user', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: { id: 'obfuscated-user', identities: [] },
      },
      error: null,
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore
      .getState()
      .signUpWithPassword('existing@example.com', 'secret1');

    const error = 'An account already exists for this email address. Sign in instead.';
    expect(result).toEqual({ status: 'error', error });
    expect(useAuthStore.getState().error).toBe(error);
  });

  it('returns the same localized error for user_already_exists', async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: Object.assign(new Error('User already registered'), {
        code: 'user_already_exists',
        status: 422,
      }),
    });

    const { useAuthStore } = await import('../auth');

    const result = await useAuthStore
      .getState()
      .signUpWithPassword('existing@example.com', 'secret1');

    const error = 'An account already exists for this email address. Sign in instead.';
    expect(result).toEqual({ status: 'error', error });
    expect(useAuthStore.getState().error).toBe(error);
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
      error: 'Failed to create account',
    });
    expect(useAuthStore.getState().error).toBe('Failed to create account');
  });
});
