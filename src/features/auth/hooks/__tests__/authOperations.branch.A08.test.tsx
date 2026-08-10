/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUpWithPassword: vi.fn(),
  signInWithPassword: vi.fn(),
  requestMagicCode: vi.fn(),
  resetPassword: vi.fn(),
  getUser: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/features/auth/auth.ts', () => ({
  useAuthStore: () => ({
    signUpWithPassword: mocks.signUpWithPassword,
    signInWithPassword: mocks.signInWithPassword,
    requestMagicCode: mocks.requestMagicCode,
    resetPassword: mocks.resetPassword,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/shared/ui/ui/sonner', () => ({
  toast: { error: mocks.toastError },
}));

import { useAuthLogin } from '../useAuthLogin';
import { useAuthSignIn } from '../useAuthSignIn';
import { useAuthSignUp } from '../useAuthSignUp';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.signUpWithPassword.mockResolvedValue({ status: 'authenticated' });
  mocks.signInWithPassword.mockResolvedValue(true);
  mocks.requestMagicCode.mockResolvedValue(true);
  mocks.resetPassword.mockResolvedValue(true);
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', created_at: new Date(Date.now() - 600_000).toISOString() } },
  });
});

describe('useAuthLogin magic-link orchestration', () => {
  it('sends a link with no optional lifecycle callbacks', async () => {
    const { result } = renderHook(() => useAuthLogin());

    await act(async () => {
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: true,
      });
    });
    expect(mocks.requestMagicCode).toHaveBeenCalledWith('ada@example.test');
    expect(result.current.isSending).toBe(false);
  });

  it('runs lifecycle callbacks in order around successful delivery', async () => {
    const order: string[] = [];
    const beforeSend = vi.fn(async () => void order.push('before'));
    const afterSend = vi.fn(async () => void order.push('after'));
    mocks.requestMagicCode.mockImplementation(async () => {
      order.push('send');
      return true;
    });
    const { result } = renderHook(() => useAuthLogin({ beforeSend, afterSend }));

    await act(async () => {
      await result.current.sendMagicLink('ada@example.test');
    });

    expect(order).toEqual(['before', 'send', 'after']);
  });

  it('reports an unsuccessful delivery through the error callback without a toast', async () => {
    mocks.requestMagicCode.mockResolvedValue(false);
    const onError = vi.fn();
    const { result } = renderHook(() => useAuthLogin({ onError }));

    await act(async () => {
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.magicLinkFailed',
      });
    });

    expect(onError).toHaveBeenCalledWith('ada@example.test', expect.any(Error));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('returns a delivery failure even when no telemetry callback is configured', async () => {
    mocks.requestMagicCode.mockResolvedValue(false);
    const { result } = renderHook(() => useAuthLogin());

    await act(async () => {
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.magicLinkFailed',
      });
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('reports thrown Errors to telemetry and the user', async () => {
    const failure = new Error('analytics unavailable');
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAuthLogin({ beforeSend: async () => Promise.reject(failure), onError })
    );

    await act(async () => {
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.unexpectedError',
      });
    });

    expect(onError).toHaveBeenCalledWith('ada@example.test', failure);
    expect(mocks.toastError).toHaveBeenCalledWith('features.auth.errors.unexpectedError');
  });

  it('does not pass non-Error rejections to the typed error callback', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAuthLogin({ beforeSend: async () => Promise.reject('cancelled'), onError })
    );

    await act(async () => {
      await result.current.sendMagicLink('ada@example.test');
    });
    expect(onError).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });
});

describe('useAuthSignIn session behavior', () => {
  it('rejects invalid credentials before asking Supabase for the user', async () => {
    mocks.signInWithPassword.mockResolvedValue(false);
    const { result } = renderHook(() => useAuthSignIn());

    await act(async () => {
      await expect(result.current.signIn('ada@example.test', 'wrong')).resolves.toEqual({
        success: false,
        isNewUser: false,
        error: 'auth.signIn.invalidCredentials',
      });
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('rejects a nominal sign-in that has no authenticated session user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const { result } = renderHook(() => useAuthSignIn());

    await act(async () => {
      await expect(result.current.signIn('ada@example.test', 'secret')).resolves.toEqual({
        success: false,
        isNewUser: false,
        error: 'features.auth.errors.authenticationFailed',
      });
    });
  });

  it.each([
    [120_000, true],
    [600_000, false],
  ])('classifies a session created %i ms ago as new=%s', async (age, expected) => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', created_at: new Date(Date.now() - age).toISOString() } },
    });
    const { result } = renderHook(() => useAuthSignIn());

    await act(async () => {
      await expect(result.current.signIn('ada@example.test', 'secret')).resolves.toEqual({
        success: true,
        isNewUser: expected,
      });
    });
  });

  it('turns unexpected password-session failures into a stable user error', async () => {
    mocks.signInWithPassword.mockRejectedValue(new Error('transport broke'));
    const { result } = renderHook(() => useAuthSignIn());

    await act(async () => {
      await expect(result.current.signIn('ada@example.test', 'secret')).resolves.toEqual({
        success: false,
        isNewUser: false,
        error: 'features.auth.errors.unexpectedError',
      });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });

  it.each([
    ['sendMagicLink', 'requestMagicCode', 'features.auth.errors.magicLinkFailed'],
    ['resetPassword', 'resetPassword', 'auth.forgotPassword.sendFailed'],
  ] as const)(
    '%s distinguishes provider rejection from success',
    async (method, mockName, error) => {
      mocks[mockName].mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const { result } = renderHook(() => useAuthSignIn());

      await act(async () => {
        await expect(result.current[method]('ada@example.test')).resolves.toEqual({
          success: false,
          error,
        });
        await expect(result.current[method]('ada@example.test')).resolves.toEqual({
          success: true,
        });
      });
    }
  );

  it.each([
    ['sendMagicLink', 'requestMagicCode'],
    ['resetPassword', 'resetPassword'],
  ] as const)('%s handles unexpected transport errors', async (method, mockName) => {
    mocks[mockName].mockRejectedValue(new Error('transport broke'));
    const { result } = renderHook(() => useAuthSignIn());

    await act(async () => {
      await expect(result.current[method]('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.unexpectedError',
      });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });
});

describe('useAuthSignUp registration behavior', () => {
  it.each(['authenticated', 'confirmation_required'] as const)(
    'preserves the %s registration state',
    async status => {
      mocks.signUpWithPassword.mockResolvedValue({ status });
      const { result } = renderHook(() => useAuthSignUp());

      await act(async () => {
        await expect(result.current.signUp('ada@example.test', 'secret')).resolves.toEqual({
          status,
        });
      });
    }
  );

  it('preserves explicit registration errors and supplies a fallback', async () => {
    mocks.signUpWithPassword
      .mockResolvedValueOnce({ status: 'error', error: 'email already used' })
      .mockResolvedValueOnce({ status: 'error' });
    const { result } = renderHook(() => useAuthSignUp());

    await act(async () => {
      await expect(result.current.signUp('ada@example.test', 'secret')).resolves.toEqual({
        status: 'error',
        error: 'email already used',
      });
      await expect(result.current.signUp('ada@example.test', 'secret')).resolves.toEqual({
        status: 'error',
        error: 'auth.signUp.signUpFailed',
      });
    });
  });

  it('handles unexpected registration failures', async () => {
    mocks.signUpWithPassword.mockRejectedValue(new Error('transport broke'));
    const { result } = renderHook(() => useAuthSignUp());

    await act(async () => {
      await expect(result.current.signUp('ada@example.test', 'secret')).resolves.toEqual({
        status: 'error',
        error: 'features.auth.errors.unexpectedError',
      });
    });
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });

  it('distinguishes successful, rejected, and exceptional magic-link requests', async () => {
    mocks.requestMagicCode
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('transport broke'));
    const { result } = renderHook(() => useAuthSignUp());

    await act(async () => {
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: true,
      });
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.magicLinkFailed',
      });
      await expect(result.current.sendMagicLink('ada@example.test')).resolves.toEqual({
        success: false,
        error: 'features.auth.errors.unexpectedError',
      });
    });
    expect(result.current.isSendingMagicLink).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledOnce();
  });
});
